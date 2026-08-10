import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoOpsApi } from "./demo-ops-api";
import { AlreadyReviewedError, NetworkError, NotFoundError } from "./errors";
import { FIXTURE_TICKETS } from "./fixtures";

/**
 * The demo client is the thing a visitor to the published URL actually exercises, so its state
 * transitions have to match the Java service's rather than merely look like them: approve
 * resolves the ticket, reject escalates it, a second decision on the same action is a 409, and
 * the metrics are arithmetic over the tickets rather than stored numbers.
 */

/**
 * The client simulates latency; nothing here should wait for it in real time.
 *
 * The outcome is captured before the clock is advanced. Attaching handlers afterwards would
 * leave a rejection unobserved for a turn, which Node reports as an unhandled rejection and
 * vitest fails the run on — for tests whose whole point is that the call rejects.
 */
async function resolve<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => () => value,
    (error: unknown) => () => {
      throw error;
    },
  );
  await vi.advanceTimersByTimeAsync(1000);
  return (await settled)();
}

describe("DemoOpsApi", () => {
  let api: DemoOpsApi;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new DemoOpsApi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists only the actions that are still pending", async () => {
    const actions = await resolve(api.listPendingActions());
    expect(actions).toHaveLength(3);
    expect(actions.every((action) => action.status === "PENDING")).toBe(true);
  });

  it("queues one action per ticket that is waiting for approval", async () => {
    const actions = await resolve(api.listPendingActions());
    const waiting = FIXTURE_TICKETS.filter((ticket) => ticket.status === "PENDING_APPROVAL");
    expect(actions.map((action) => action.ticketId).sort()).toEqual(
      waiting.map((ticket) => ticket.id).sort(),
    );
  });

  describe("approve", () => {
    it("resolves the ticket and records who did it", async () => {
      await resolve(api.approve(1, "ops-jane"));

      const ticket = await resolve(api.getTicket(2));
      expect(ticket.status).toBe("RESOLVED_AUTO");
      expect(ticket.resolvedAt).not.toBeNull();

      const log = await resolve(api.getAuditLog(2));
      const approved = log.at(-1);
      expect(approved?.eventType).toBe("ACTION_APPROVED");
      expect(approved?.payload).toMatchObject({
        pendingActionId: 1,
        reviewedBy: "ops-jane",
        result: "Changed bob@acme.example's plan to pro",
      });
    });

    it("takes the action out of the queue", async () => {
      await resolve(api.approve(1, "ops-jane"));
      const actions = await resolve(api.listPendingActions());
      expect(actions.map((action) => action.id)).not.toContain(1);
    });

    /*
     * The backend's guarantee, reproduced: `transitionIfPending` is a conditional UPDATE, so a
     * double-click or a retried request finds no PENDING row the second time and gets a 409
     * instead of executing the refund twice.
     */
    it("rejects a second decision on the same action with a conflict", async () => {
      await resolve(api.approve(2, "ops-jane"));
      await expect(resolve(api.approve(2, "ops-bob"))).rejects.toBeInstanceOf(
        AlreadyReviewedError,
      );
    });

    it("will not approve an action that was already rejected", async () => {
      await resolve(api.reject(2, "Not owed", "ops-jane"));
      await expect(resolve(api.approve(2, "ops-bob"))).rejects.toBeInstanceOf(
        AlreadyReviewedError,
      );
    });

    it("reports an unknown action as not found", async () => {
      await expect(resolve(api.approve(999, "ops-jane"))).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("reject", () => {
    it("escalates the ticket and writes both events the backend writes", async () => {
      await resolve(api.reject(1, "The customer did not ask for this", "ops-jane"));

      const ticket = await resolve(api.getTicket(2));
      expect(ticket.status).toBe("ESCALATED");
      expect(ticket.resolvedAt).toBeNull();

      const log = await resolve(api.getAuditLog(2));
      expect(log.at(-2)).toMatchObject({
        eventType: "ACTION_REJECTED",
        payload: { reviewedBy: "ops-jane", reason: "The customer did not ask for this" },
      });
      expect(log.at(-1)).toMatchObject({
        eventType: "ESCALATED_TO_HUMAN",
        payload: { reason: "PendingAction 1 rejected: The customer did not ask for this" },
      });
    });
  });

  describe("getMetrics", () => {
    it("counts the fixture tickets by status", async () => {
      const metrics = await resolve(api.getMetrics());

      expect(metrics.totalTickets).toBe(FIXTURE_TICKETS.length);
      expect(metrics.resolvedAutoCount).toBe(
        FIXTURE_TICKETS.filter((ticket) => ticket.status === "RESOLVED_AUTO").length,
      );
      expect(metrics.pendingApprovalCount).toBe(
        FIXTURE_TICKETS.filter((ticket) => ticket.status === "PENDING_APPROVAL").length,
      );
      expect(metrics.escalatedCount).toBe(
        FIXTURE_TICKETS.filter((ticket) => ticket.status === "ESCALATED").length,
      );
      expect(metrics.errorCount).toBe(0);
    });

    it("derives the rate rather than storing it", async () => {
      const metrics = await resolve(api.getMetrics());
      expect(metrics.autonomousResolutionRate).toBeCloseTo(
        metrics.resolvedAutoCount / metrics.totalTickets,
      );
    });

    /* The whole point of computing metrics: a decision made in the UI has to move them. */
    it("moves when an action is approved", async () => {
      const before = await resolve(api.getMetrics());
      await resolve(api.approve(1, "ops-jane"));
      const after = await resolve(api.getMetrics());

      expect(after.resolvedAutoCount).toBe(before.resolvedAutoCount + 1);
      expect(after.pendingApprovalCount).toBe(before.pendingApprovalCount - 1);
      expect(after.totalTickets).toBe(before.totalTickets);
      expect(after.autonomousResolutionRate).toBeGreaterThan(before.autonomousResolutionRate);
    });

    it("moves a rejected ticket to the escalated count, not the resolved one", async () => {
      const before = await resolve(api.getMetrics());
      await resolve(api.reject(1, "Not owed", "ops-jane"));
      const after = await resolve(api.getMetrics());

      expect(after.escalatedCount).toBe(before.escalatedCount + 1);
      expect(after.resolvedAutoCount).toBe(before.resolvedAutoCount);
    });

    it("averages only over tickets that have a resolution time", async () => {
      const metrics = await resolve(api.getMetrics());
      expect(metrics.averageResolutionSeconds).not.toBeNull();
      expect(metrics.averageResolutionSeconds).toBeGreaterThan(0);
    });
  });

  describe("demo controls", () => {
    it("makes exactly one write fail with a conflict, then clears itself", async () => {
      api.setSimulateConflict(true);

      await expect(resolve(api.approve(1, "ops-jane"))).rejects.toBeInstanceOf(
        AlreadyReviewedError,
      );

      // The failed write must not have changed anything.
      const ticket = await resolve(api.getTicket(2));
      expect(ticket.status).toBe("PENDING_APPROVAL");

      // And the next attempt goes through, so the switch is a one-shot rather than a mode.
      await resolve(api.approve(1, "ops-jane"));
      expect((await resolve(api.getTicket(2))).status).toBe("RESOLVED_AUTO");
    });

    it("fails every call while the offline switch is on", async () => {
      api.setSimulateOffline(true);
      await expect(resolve(api.listPendingActions())).rejects.toBeInstanceOf(NetworkError);
      await expect(resolve(api.getMetrics())).rejects.toBeInstanceOf(NetworkError);
      await expect(resolve(api.approve(1, "ops-jane"))).rejects.toBeInstanceOf(NetworkError);

      api.setSimulateOffline(false);
      await expect(resolve(api.listPendingActions())).resolves.toHaveLength(3);
    });
  });

  it("keeps decisions across a reload, and forgets them on reset", async () => {
    await resolve(api.approve(1, "ops-jane"));

    // A fresh instance is what a page refresh produces; sessionStorage is what carries the state.
    const afterReload = new DemoOpsApi();
    expect((await resolve(afterReload.listPendingActions())).map((a) => a.id)).not.toContain(1);

    afterReload.reset();
    expect((await resolve(afterReload.listPendingActions()))).toHaveLength(3);
  });
});
