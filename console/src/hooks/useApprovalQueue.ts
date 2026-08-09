"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlreadyReviewedError, NetworkError } from "@/api/errors";
import type { OpsApi } from "@/api/ops-api";
import type { PendingAction } from "@/api/types";
import { describeAction } from "@/domain/tools";
import type { Tone } from "@/domain/audit";

export interface QueueNotice {
  tone: Tone;
  title: string;
  body: string;
}

export type QueuePhase = "loading" | "ready" | "error";

export interface ApprovalQueue {
  phase: QueuePhase;
  actions: PendingAction[];
  error: Error | null;
  /** Ids with a write in flight — their card shows a busy state and cannot be clicked again. */
  inFlight: ReadonlySet<number>;
  notice: QueueNotice | null;
  dismissNotice: () => void;
  refresh: () => void;
  approve: (action: PendingAction) => Promise<void>;
  reject: (action: PendingAction, reason: string) => Promise<void>;
}

/**
 * The approval queue, with optimistic writes.
 *
 * Optimism is worth the complexity here because the operator's job is a sequence of decisions,
 * and a card that lingers for a round trip after being dealt with invites a second click on
 * something already approved. The card leaves the moment the decision is made.
 *
 * The cost of optimism is that failures have to be undone honestly, and there are two kinds:
 *
 * - The write failed and the action is still pending — network down, validation rejected at
 *   approval time. The card comes back, at the position it left from, and the operator is told
 *   why. Putting it back at the end of the list would be a small lie about the queue's order.
 *
 * - The write failed with 409 because the action is no longer PENDING. Someone else reviewed
 *   it first. The card must *not* come back: it genuinely left the queue, just not by this
 *   operator's hand. Restoring it would invite them to click again on something that is gone.
 */
export function useApprovalQueue(api: OpsApi, reviewedBy: string): ApprovalQueue {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [inFlight, setInFlight] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<QueueNotice | null>(null);

  // Bumping this re-runs the load effect; the effect owns its own AbortController so a refresh
  // during an in-flight load cannot deliver the older response second.
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedToken, setLoadedToken] = useState(-1);
  const mounted = useRef(true);

  /*
   * "Loading" is derived from the two tokens rather than set at the top of the effect. Setting
   * it there would mean writing state synchronously during an effect, which schedules a second
   * render for something already knowable from what is in hand: a request whose result has not
   * landed yet is exactly one where the requested token is ahead of the loaded one.
   */
  const phase: QueuePhase =
    loadedToken !== reloadToken ? "loading" : error !== null ? "error" : "ready";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    api
      .listPendingActions(controller.signal)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setActions(loaded);
        setError(null);
        setLoadedToken(reloadToken);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === "AbortError")) {
          return;
        }
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoadedToken(reloadToken);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, reloadToken]);

  const refresh = useCallback(() => {
    setNotice(null);
    setReloadToken((token) => token + 1);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const runWrite = useCallback(
    async (action: PendingAction, write: () => Promise<void>, successTitle: string) => {
      // Capture the position before removing, so a rollback restores the order the operator saw.
      let restoreIndex = -1;
      setActions((current) => {
        restoreIndex = current.findIndex((candidate) => candidate.id === action.id);
        return current.filter((candidate) => candidate.id !== action.id);
      });

      setInFlight((current) => new Set(current).add(action.id));

      try {
        await write();
        if (!mounted.current) {
          return;
        }
        setNotice({
          tone: "positive",
          title: successTitle,
          body: describeAction(action.toolName, action.parameters),
        });
      } catch (cause: unknown) {
        if (!mounted.current) {
          return;
        }

        if (cause instanceof AlreadyReviewedError) {
          setNotice({
            tone: "warning",
            title: "Another operator got there first",
            body: `This action had already been reviewed, so nothing was changed by you. It has left the queue for ${action.subject}.`,
          });
          return;
        }

        setActions((current) => reinsert(current, action, restoreIndex));

        setNotice({
          tone: "negative",
          title: "The action was not recorded",
          body:
            cause instanceof NetworkError
              ? "The console could not reach the API, so nothing was changed. The card is back in the queue — try again."
              : `${cause instanceof Error ? cause.message : String(cause)} Nothing was changed; the card is back in the queue.`,
        });
      } finally {
        if (mounted.current) {
          setInFlight((current) => {
            const next = new Set(current);
            next.delete(action.id);
            return next;
          });
        }
      }
    },
    [],
  );

  const approve = useCallback(
    (action: PendingAction) =>
      runWrite(action, () => api.approve(action.id, reviewedBy), "Approved and executed"),
    [api, reviewedBy, runWrite],
  );

  const reject = useCallback(
    (action: PendingAction, reason: string) =>
      runWrite(
        action,
        () => api.reject(action.id, reason, reviewedBy),
        "Rejected and escalated to a human",
      ),
    [api, reviewedBy, runWrite],
  );

  return {
    phase,
    actions,
    error,
    inFlight,
    notice,
    dismissNotice,
    refresh,
    approve,
    reject,
  };
}

/**
 * Puts a rolled-back action back where it was. If the queue changed underneath — a refresh
 * landed, other cards were dealt with — the index may no longer be valid, and appending is the
 * only honest fallback.
 */
function reinsert(
  actions: PendingAction[],
  action: PendingAction,
  index: number,
): PendingAction[] {
  if (actions.some((candidate) => candidate.id === action.id)) {
    return actions;
  }
  const next = [...actions];
  if (index < 0 || index > next.length) {
    next.push(action);
  } else {
    next.splice(index, 0, action);
  }
  return next;
}
