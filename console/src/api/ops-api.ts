import type {
  AuditLogEntry,
  MetricsSummary,
  PendingAction,
  Ticket,
} from "./types";

/**
 * Everything the console can ask of the backend. Two implementations exist — one that
 * talks HTTP to a running ops-copilot, one that runs off fixtures — and the UI is written
 * against this interface so neither is a special case of the other.
 */
export interface OpsApi {
  listPendingActions(signal?: AbortSignal): Promise<PendingAction[]>;

  /** Resolves on success; the endpoint returns 200 with an empty body. */
  approve(id: number, reviewedBy: string): Promise<void>;

  reject(id: number, reason: string, reviewedBy: string): Promise<void>;

  getTicket(id: number, signal?: AbortSignal): Promise<Ticket>;

  getAuditLog(id: number, signal?: AbortSignal): Promise<AuditLogEntry[]>;

  getMetrics(signal?: AbortSignal): Promise<MetricsSummary>;
}
