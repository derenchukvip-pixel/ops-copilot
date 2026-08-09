import { AlreadyReviewedError, NetworkError, NotFoundError } from "./errors";
import {
  FIXTURE_MAX_AUDIT_ID,
  FIXTURE_PENDING_ACTIONS,
  FIXTURE_TICKETS,
} from "./fixtures";
import type { OpsApi } from "./ops-api";
import type {
  AuditLogEntry,
  MetricsSummary,
  PendingAction,
  Ticket,
} from "./types";

const STORAGE_KEY = "ops-console-demo-v1";

/** Long enough that skeletons are actually seen, short enough not to feel broken. */
const READ_LATENCY_MS = 320;
const WRITE_LATENCY_MS = 520;

interface DemoState {
  seededAt: number;
  tickets: Array<Ticket & { auditLog: AuditLogEntry[] }>;
  pendingActions: PendingAction[];
  nextAuditId: number;
  /** When set, the next write fails the way the backend fails when someone got there first. */
  simulateConflict: boolean;
  /** When set, every call fails as if the API were unreachable. */
  simulateOffline: boolean;
}

function minutesAgo(seededAt: number, minutes: number): string {
  return new Date(seededAt - minutes * 60_000).toISOString();
}

/**
 * Builds the dataset with every timestamp measured back from now.
 *
 * A seed is not persisted — only writes are — so a reload before any decision has been made
 * produces a fresh seed and the queue still reads "23 min ago" rather than ageing into "4 h ago"
 * while a tab sits open. After the first approve or reject the state is stored and stops moving,
 * which is the right trade: at that point the operator's own actions are in it.
 */
function seed(): DemoState {
  const seededAt = Date.now();

  return {
    seededAt,
    tickets: FIXTURE_TICKETS.map((fixture) => {
      const { receivedAtMinutesAgo, resolvedAtMinutesAgo, auditLog, ...rest } = fixture;
      return {
        ...rest,
        receivedAt: minutesAgo(seededAt, receivedAtMinutesAgo),
        resolvedAt:
          resolvedAtMinutesAgo === null ? null : minutesAgo(seededAt, resolvedAtMinutesAgo),
        createdAt: minutesAgo(seededAt, receivedAtMinutesAgo),
        auditLog: auditLog.map(({ createdAtMinutesAgo, ...entry }) => ({
          ...entry,
          createdAt: minutesAgo(seededAt, createdAtMinutesAgo),
        })),
      };
    }),
    pendingActions: FIXTURE_PENDING_ACTIONS.map(({ createdAtMinutesAgo, ...rest }) => ({
      ...rest,
      createdAt: minutesAgo(seededAt, createdAtMinutesAgo),
      reviewedAt: null,
    })),
    nextAuditId: FIXTURE_MAX_AUDIT_ID + 1,
    simulateConflict: false,
    simulateOffline: false,
  };
}

/**
 * An in-memory ops-copilot.
 *
 * The published demo is a static site with no backend behind it — partly so it works when
 * nothing is running, and partly because the real agent spends money at Anthropic on every
 * ticket and a public URL is not a safe place to put that. So this implementation holds the
 * whole dataset itself and applies the same state transitions the Java service applies:
 * approve executes and resolves the ticket, reject escalates it, and both write the audit
 * events `PendingActionService` writes, in the same order.
 *
 * State lives in sessionStorage, so approving something and refreshing does not quietly undo
 * the operator's work — a demo where the buttons do not change anything is worse than no demo.
 */
export class DemoOpsApi implements OpsApi {
  private state: DemoState;

  constructor() {
    this.state = this.load();
  }

  /**
   * Session storage is a convenience here, not a requirement: without it the demo still works,
   * it just forgets decisions on refresh. Access is guarded because Safari throws on it in some
   * private-browsing contexts, and losing the demo's persistence must not take the page with it.
   */
  private static storage(): Storage | null {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return window.sessionStorage ?? null;
    } catch {
      return null;
    }
  }

  private load(): DemoState {
    const stored = DemoOpsApi.storage()?.getItem(STORAGE_KEY);
    if (!stored) {
      return seed();
    }
    try {
      return JSON.parse(stored) as DemoState;
    } catch {
      // A half-written or stale-shaped blob is not worth recovering from.
      return seed();
    }
  }

  private persist(): void {
    try {
      DemoOpsApi.storage()?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Quota exceeded. In-memory state is unaffected; only persistence across a reload is lost.
    }
  }

  private async settle(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    if (this.state.simulateOffline) {
      throw new NetworkError();
    }
  }

  async listPendingActions(): Promise<PendingAction[]> {
    await this.settle(READ_LATENCY_MS);
    return this.state.pendingActions
      .filter((action) => action.status === "PENDING")
      .map((action) => ({ ...action }));
  }

  async approve(id: number, reviewedBy: string): Promise<void> {
    await this.settle(WRITE_LATENCY_MS);
    const action = this.transition(id, "APPROVED", reviewedBy, null);

    const ticket = this.requireTicket(action.ticketId);
    const reviewedAt = new Date().toISOString();

    this.appendAudit(ticket, "ACTION_APPROVED", {
      pendingActionId: action.id,
      reviewedBy,
      result: executionSummary(action),
    });

    ticket.status = "RESOLVED_AUTO";
    ticket.resolvedAt = reviewedAt;
    this.persist();
  }

  async reject(id: number, reason: string, reviewedBy: string): Promise<void> {
    await this.settle(WRITE_LATENCY_MS);
    const action = this.transition(id, "REJECTED", reviewedBy, reason);

    const ticket = this.requireTicket(action.ticketId);

    this.appendAudit(ticket, "ACTION_REJECTED", {
      pendingActionId: action.id,
      reviewedBy,
      reason,
    });
    this.appendAudit(ticket, "ESCALATED_TO_HUMAN", {
      reason: `PendingAction ${action.id} rejected: ${reason}`,
    });

    ticket.status = "ESCALATED";
    this.persist();
  }

  async getTicket(id: number): Promise<Ticket> {
    await this.settle(READ_LATENCY_MS);
    // The audit log lives on the same record here but is a separate endpoint on the API, so
    // it is dropped rather than leaked into the ticket response.
    const { auditLog, ...ticket } = this.requireTicket(id);
    return { ...ticket };
  }

  async getAuditLog(id: number): Promise<AuditLogEntry[]> {
    await this.settle(READ_LATENCY_MS);
    return this.requireTicket(id).auditLog.map((entry) => ({ ...entry }));
  }

  /**
   * Computed, never stored. This is deliberately the same arithmetic as `MetricsService`:
   * count by status, divide resolved-automatically by the total, average the gap between
   * receivedAt and resolvedAt over tickets that have one — and return null, not zero, when
   * nothing has been resolved.
   */
  async getMetrics(): Promise<MetricsSummary> {
    await this.settle(READ_LATENCY_MS);

    const tickets = this.state.tickets;
    const countOf = (status: Ticket["status"]) =>
      tickets.filter((ticket) => ticket.status === status).length;

    const totalTickets = tickets.length;
    const resolvedAutoCount = countOf("RESOLVED_AUTO");

    const resolutionSeconds = tickets
      .filter((ticket) => ticket.resolvedAt !== null)
      .map(
        (ticket) =>
          (Date.parse(ticket.resolvedAt as string) - Date.parse(ticket.receivedAt)) / 1000,
      );

    return {
      totalTickets,
      resolvedAutoCount,
      pendingApprovalCount: countOf("PENDING_APPROVAL"),
      escalatedCount: countOf("ESCALATED"),
      errorCount: countOf("ERROR"),
      autonomousResolutionRate: totalTickets === 0 ? 0 : resolvedAutoCount / totalTickets,
      averageResolutionSeconds:
        resolutionSeconds.length === 0
          ? null
          : resolutionSeconds.reduce((sum, value) => sum + value, 0) / resolutionSeconds.length,
    };
  }

  /**
   * The demo equivalent of `transitionIfPending`: a row that is no longer PENDING is not
   * updated, and the caller gets the same 409 the API would return.
   */
  private transition(
    id: number,
    status: "APPROVED" | "REJECTED",
    reviewedBy: string,
    reason: string | null,
  ): PendingAction {
    const action = this.state.pendingActions.find((candidate) => candidate.id === id);
    if (!action) {
      throw new NotFoundError(`PendingAction ${id} not found`);
    }

    if (this.state.simulateConflict) {
      this.state.simulateConflict = false;
      this.persist();
      throw new AlreadyReviewedError(`PendingAction ${id} has already been reviewed`);
    }

    if (action.status !== "PENDING") {
      throw new AlreadyReviewedError(`PendingAction ${id} has already been reviewed`);
    }

    action.status = status;
    action.reviewedBy = reviewedBy;
    action.reviewedAt = new Date().toISOString();
    action.reason = reason;
    return action;
  }

  private requireTicket(id: number): Ticket & { auditLog: AuditLogEntry[] } {
    const ticket = this.state.tickets.find((candidate) => candidate.id === id);
    if (!ticket) {
      throw new NotFoundError(`Ticket ${id} not found`);
    }
    return ticket;
  }

  private appendAudit(
    ticket: Ticket & { auditLog: AuditLogEntry[] },
    eventType: AuditLogEntry["eventType"],
    payload: AuditLogEntry["payload"],
  ): void {
    ticket.auditLog.push({
      id: this.state.nextAuditId++,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  // --- Demo-only controls. Not part of OpsApi; the live client has no equivalent. ---

  reset(): void {
    this.state = seed();
    this.persist();
  }

  setSimulateConflict(enabled: boolean): void {
    this.state.simulateConflict = enabled;
    this.persist();
  }

  setSimulateOffline(enabled: boolean): void {
    this.state.simulateOffline = enabled;
    this.persist();
  }

  get flags(): { simulateConflict: boolean; simulateOffline: boolean } {
    return {
      simulateConflict: this.state.simulateConflict,
      simulateOffline: this.state.simulateOffline,
    };
  }
}

/**
 * Mirrors the summary string each tool's `execute` returns, since that string is what the
 * backend stores in the ACTION_APPROVED payload and the audit timeline reads back.
 */
function executionSummary(action: PendingAction): string {
  const params = action.parameters;

  if (action.toolName === "change_subscription_plan") {
    return `Changed ${String(params.customerEmail)}'s plan to ${String(params.targetPlan)}`;
  }
  if (action.toolName === "issue_refund") {
    return `Refunded ${Number(params.amount).toFixed(2)} to ${String(params.customerEmail)}`;
  }
  return `Executed ${action.toolName}`;
}
