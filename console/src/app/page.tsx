"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PlugZap, RefreshCw, Settings } from "lucide-react";
import { API_BASE_URL, getOpsApi, IS_DEMO, liveConfigError } from "@/api";
import { NetworkError } from "@/api/errors";
import type { PendingAction } from "@/api/types";
import { ApproveMoneyDialog } from "@/components/ApproveMoneyDialog";
import { NoticeBanner } from "@/components/NoticeBanner";
import { PendingActionCard } from "@/components/PendingActionCard";
import { RejectDialog } from "@/components/RejectDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingAnnouncement, QueueSkeleton } from "@/components/ui/states";
import { moneyAtStake } from "@/domain/money";
import { useApprovalQueue } from "@/hooks/useApprovalQueue";
import { useOperator } from "@/hooks/useOperatorName";

export default function QueuePage() {
  const api = useMemo(() => getOpsApi(), []);
  const { operator } = useOperator();
  const queue = useApprovalQueue(api, operator);

  const [pendingApproval, setPendingApproval] = useState<PendingAction | null>(null);
  const [pendingRejection, setPendingRejection] = useState<PendingAction | null>(null);

  // Relative timestamps are only correct for as long as nobody leaves the tab open. A minute
  // is fine: the queue's own granularity is minutes.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const configError = liveConfigError();
  if (configError) {
    return (
      <ErrorState
        icon={<Settings className="size-12" />}
        title="The console is not configured"
        description={
          <>
            <p>{configError}</p>
            <p className="mt-2">
              A live build needs the address of a running Ops Copilot. Set it and rebuild, or use
              the demo build, which needs no backend at all.
            </p>
          </>
        }
      />
    );
  }

  const handleApprove = (action: PendingAction) => {
    // Only actions that move money get a confirmation step. Confirming everything trains
    // people to click through confirmations.
    if (moneyAtStake(action.parameters)) {
      setPendingApproval(action);
      return;
    }
    void queue.approve(action);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-ink">Approval queue</h1>
          <p className="mt-1 text-caption text-ink-muted">
            Actions the agent will not take without a person. Approving runs the action
            immediately.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={queue.refresh}
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
        >
          Refresh
        </Button>
      </div>

      {queue.notice ? (
        <NoticeBanner notice={queue.notice} onDismiss={queue.dismissNotice} />
      ) : null}

      {queue.phase === "loading" ? (
        <>
          <LoadingAnnouncement label="Loading the approval queue" />
          <QueueSkeleton />
        </>
      ) : null}

      {queue.phase === "error" ? (
        <ErrorState
          icon={<PlugZap className="size-12" />}
          title={
            queue.error instanceof NetworkError
              ? "Can't reach the API"
              : "The queue could not be loaded"
          }
          description={
            queue.error instanceof NetworkError ? (
              <>
                <p>
                  Nothing answered at{" "}
                  <code className="rounded-[8px] bg-surface-subtle px-1.5 py-0.5 text-ink">
                    {IS_DEMO ? "the demo client" : API_BASE_URL}
                  </code>
                  .
                </p>
                <p className="mt-2">
                  The backend may be down — or running, but not allowing requests from this
                  origin. Nothing was changed either way.
                </p>
              </>
            ) : (
              <p>{queue.error?.message}</p>
            )
          }
          action={
            <Button
              variant="primary"
              onClick={queue.refresh}
              icon={<RefreshCw aria-hidden="true" className="size-4" />}
            >
              Try again
            </Button>
          }
        />
      ) : null}

      {queue.phase === "ready" && queue.actions.length === 0 ? (
        // An empty queue is the good outcome, and it should read like one. "No data" would
        // report the same fact and imply something went wrong.
        <EmptyState
          icon={<CheckCircle2 className="size-12" />}
          title="Nothing waiting"
          description="The agent handled everything it was allowed to handle on its own. Anything it cannot decide alone will appear here."
          action={
            <Link
              href="/metrics"
              className="inline-flex h-12 items-center rounded-[14px] border border-line px-6 text-body font-semibold text-ink hover:bg-surface-subtle"
            >
              See how much it handled
            </Link>
          }
        />
      ) : null}

      {queue.phase === "ready" && queue.actions.length > 0 ? (
        <>
          <p aria-live="polite" className="text-caption text-ink-muted">
            {queue.actions.length} {queue.actions.length === 1 ? "action" : "actions"} waiting for
            a decision
          </p>
          <div className="flex flex-col gap-4">
            {queue.actions.map((action) => (
              <PendingActionCard
                key={action.id}
                action={action}
                busy={queue.inFlight.has(action.id)}
                now={now}
                onApprove={() => handleApprove(action)}
                onReject={() => setPendingRejection(action)}
              />
            ))}
          </div>
        </>
      ) : null}

      <ApproveMoneyDialog
        action={pendingApproval}
        onCancel={() => setPendingApproval(null)}
        onConfirm={() => {
          const action = pendingApproval;
          setPendingApproval(null);
          if (action) {
            void queue.approve(action);
          }
        }}
      />

      <RejectDialog
        action={pendingRejection}
        onCancel={() => setPendingRejection(null)}
        onConfirm={(reason) => {
          const action = pendingRejection;
          setPendingRejection(null);
          if (action) {
            void queue.reject(action, reason);
          }
        }}
      />
    </div>
  );
}
