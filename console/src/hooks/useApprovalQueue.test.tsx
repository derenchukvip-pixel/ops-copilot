import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlreadyReviewedError, NetworkError } from "@/api/errors";
import type { OpsApi } from "@/api/ops-api";
import type { PendingAction } from "@/api/types";
import { useApprovalQueue } from "./useApprovalQueue";

function action(id: number, overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    id,
    ticketId: id * 10,
    customerEmail: `customer${id}@example.test`,
    subject: `Subject ${id}`,
    toolName: "change_subscription_plan",
    parameters: { customerEmail: `customer${id}@example.test`, targetPlan: "pro" },
    status: "PENDING",
    category: "plan_change_request",
    confidence: 0.9,
    reasoning: "Reasoning",
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
    createdAt: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

/** A promise whose settlement the test controls, so the optimistic window can be inspected. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeApi(overrides: Partial<OpsApi> = {}): OpsApi {
  return {
    listPendingActions: vi.fn().mockResolvedValue([action(1), action(2), action(3)]),
    approve: vi.fn().mockResolvedValue(undefined),
    reject: vi.fn().mockResolvedValue(undefined),
    getTicket: vi.fn(),
    getAuditLog: vi.fn(),
    getMetrics: vi.fn(),
    ...overrides,
  };
}

async function renderReadyQueue(api: OpsApi) {
  const view = renderHook(() => useApprovalQueue(api, "ops-jane"));
  await waitFor(() => expect(view.result.current.phase).toBe("ready"));
  return view;
}

describe("useApprovalQueue", () => {
  it("starts in a loading phase and lands on the loaded actions", async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useApprovalQueue(api, "ops-jane"));

    expect(result.current.phase).toBe("loading");
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(result.current.actions.map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it("surfaces a load failure as an error phase rather than an empty queue", async () => {
    const api = fakeApi({ listPendingActions: vi.fn().mockRejectedValue(new NetworkError()) });
    const { result } = renderHook(() => useApprovalQueue(api, "ops-jane"));

    await waitFor(() => expect(result.current.phase).toBe("error"));
    // An empty queue is good news; a failed load must never be shown as one.
    expect(result.current.actions).toHaveLength(0);
    expect(result.current.error).toBeInstanceOf(NetworkError);
  });

  it("sends the operator's name with the decision", async () => {
    const api = fakeApi();
    const { result } = await renderReadyQueue(api);

    await act(async () => {
      await result.current.approve(action(2));
    });
    expect(api.approve).toHaveBeenCalledWith(2, "ops-jane");

    await act(async () => {
      await result.current.reject(action(3), "Not owed");
    });
    expect(api.reject).toHaveBeenCalledWith(3, "Not owed", "ops-jane");
  });

  describe("optimistic writes", () => {
    it("removes the card before the request comes back", async () => {
      const pending = deferred<void>();
      const api = fakeApi({ approve: vi.fn().mockReturnValue(pending.promise) });
      const { result } = await renderReadyQueue(api);

      let call: Promise<void>;
      act(() => {
        call = result.current.approve(action(2));
      });

      // The whole point of optimism: the queue is already shorter while the write is in flight.
      await waitFor(() => expect(result.current.actions.map((a) => a.id)).toEqual([1, 3]));
      expect(result.current.inFlight.has(2)).toBe(true);

      await act(async () => {
        pending.resolve();
        await call;
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([1, 3]);
      expect(result.current.inFlight.has(2)).toBe(false);
      expect(result.current.notice?.tone).toBe("positive");
    });

    /*
     * A rollback that appends to the end would quietly reorder the operator's queue and make it
     * look as though the card had only just arrived.
     */
    it("puts a failed card back exactly where it was", async () => {
      const api = fakeApi({ approve: vi.fn().mockRejectedValue(new NetworkError()) });
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.approve(action(2));
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([1, 2, 3]);
      expect(result.current.notice?.tone).toBe("negative");
      expect(result.current.notice?.body).toMatch(/nothing was changed/i);
    });

    it("rolls back a failed rejection the same way", async () => {
      const api = fakeApi({ reject: vi.fn().mockRejectedValue(new NetworkError()) });
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.reject(action(1), "Not owed");
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([1, 2, 3]);
      expect(result.current.notice?.tone).toBe("negative");
    });

    /*
     * 409 means the action is genuinely gone from the queue — another operator reviewed it
     * first. Restoring the card would invite a second click on something that no longer exists,
     * and would claim this operator's decision had failed when in truth it was never needed.
     */
    it("does not restore a card that someone else already reviewed", async () => {
      const api = fakeApi({
        approve: vi.fn().mockRejectedValue(new AlreadyReviewedError("already reviewed")),
      });
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.approve(action(2));
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([1, 3]);
      expect(result.current.notice?.tone).toBe("warning");
      expect(result.current.notice?.title).toMatch(/another operator/i);
      expect(result.current.notice?.body).toMatch(/nothing was changed by you/i);
    });

    it("applies the same 409 rule to a rejection", async () => {
      const api = fakeApi({
        reject: vi.fn().mockRejectedValue(new AlreadyReviewedError("already reviewed")),
      });
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.reject(action(2), "Not owed");
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([1, 3]);
      expect(result.current.notice?.tone).toBe("warning");
    });

    it("keeps the message from an unexpected API error", async () => {
      const api = fakeApi({ approve: vi.fn().mockRejectedValue(new Error("Refund amount 9000 exceeds the maximum")) });
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.approve(action(2));
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([1, 2, 3]);
      expect(result.current.notice?.body).toMatch(/exceeds the maximum/);
    });

    it("handles two decisions in a row without losing either", async () => {
      const api = fakeApi();
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.approve(action(1));
      });
      await act(async () => {
        await result.current.reject(action(3), "Not owed");
      });

      expect(result.current.actions.map((a) => a.id)).toEqual([2]);
      expect(result.current.inFlight.size).toBe(0);
    });
  });

  describe("refresh", () => {
    it("reloads the queue and clears the last notice", async () => {
      const listPendingActions = vi
        .fn()
        .mockResolvedValueOnce([action(1), action(2), action(3)])
        .mockResolvedValueOnce([action(4)]);
      const api = fakeApi({ listPendingActions });
      const { result } = await renderReadyQueue(api);

      await act(async () => {
        await result.current.approve(action(1));
      });
      expect(result.current.notice).not.toBeNull();

      act(() => {
        result.current.refresh();
      });
      expect(result.current.notice).toBeNull();

      await waitFor(() => expect(result.current.actions.map((a) => a.id)).toEqual([4]));
      expect(result.current.phase).toBe("ready");
    });

    it("recovers from an error phase when the API comes back", async () => {
      const listPendingActions = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError())
        .mockResolvedValueOnce([action(1)]);
      const api = fakeApi({ listPendingActions });
      const { result } = renderHook(() => useApprovalQueue(api, "ops-jane"));

      await waitFor(() => expect(result.current.phase).toBe("error"));

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => expect(result.current.phase).toBe("ready"));
      expect(result.current.error).toBeNull();
      expect(result.current.actions.map((a) => a.id)).toEqual([1]);
    });
  });

  it("dismisses a notice on request", async () => {
    const api = fakeApi();
    const { result } = await renderReadyQueue(api);

    await act(async () => {
      await result.current.approve(action(1));
    });
    expect(result.current.notice).not.toBeNull();

    act(() => {
      result.current.dismissNotice();
    });
    expect(result.current.notice).toBeNull();
  });
});
