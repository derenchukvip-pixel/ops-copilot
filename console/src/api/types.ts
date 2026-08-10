/**
 * Wire types. These mirror the Java DTOs one-for-one — field names and nullability
 * are taken from the record definitions in `src/main/java/dev/artsiom/opscopilot/dto`,
 * not from the README, so they stay honest if the two ever drift.
 */

/** `domain/PendingActionStatus.java` */
export type PendingActionStatus = "PENDING" | "APPROVED" | "REJECTED";

/** `domain/TicketStatus.java` */
export type TicketStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "RESOLVED_AUTO"
  | "PENDING_APPROVAL"
  | "ESCALATED"
  | "ERROR";

/**
 * `domain/TicketCategory.java`. The wire value is lowercase snake_case — the enum
 * serialises via `@JsonValue`, so these strings are what actually crosses the network.
 */
export type TicketCategory =
  | "password_reset"
  | "billing_invoice_request"
  | "plan_change_request"
  | "refund_request"
  | "bug_report"
  | "feature_request"
  | "spam_or_abuse"
  | "unclear";

/** `domain/AuditEventType.java` — all ten, in the order they are declared. */
export type AuditEventType =
  | "TICKET_RECEIVED"
  | "CLASSIFIED"
  | "TOOL_CALLED"
  | "TOOL_RESULT"
  | "ACTION_AUTO_EXECUTED"
  | "ACTION_QUEUED_FOR_APPROVAL"
  | "ACTION_APPROVED"
  | "ACTION_REJECTED"
  | "ESCALATED_TO_HUMAN"
  | "ERROR";

/** Audit payloads are free-form JSON columns; every read of one has to be defensive. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/**
 * `dto/PendingActionResponse.java`.
 *
 * `category`, `confidence` and `reasoning` come from the most recent AgentDecision for
 * the ticket and are all null when no decision row exists — `PendingActionService.toResponse`
 * passes null for each when `findFirstByTicketIdOrderByCreatedAtDesc` is empty. The UI
 * must render a card without them.
 *
 * `confidence` is a Java BigDecimal, which Jackson serialises as a JSON number.
 */
export interface PendingAction {
  id: number;
  ticketId: number;
  customerEmail: string;
  subject: string;
  toolName: string;
  parameters: JsonObject;
  status: PendingActionStatus;
  category: TicketCategory | null;
  confidence: number | null;
  reasoning: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reason: string | null;
  createdAt: string;
}

/** `dto/TicketResponse.java` */
export interface Ticket {
  id: number;
  externalId: string;
  customerEmail: string;
  subject: string;
  body: string;
  status: TicketStatus;
  receivedAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

/** `dto/AuditLogEntryResponse.java`. `payload` is nullable — see `AuditLogService.parsePayload`. */
export interface AuditLogEntry {
  id: number;
  eventType: AuditEventType;
  payload: JsonObject | null;
  createdAt: string;
}

/**
 * `dto/MetricsSummaryResponse.java`.
 *
 * `averageResolutionSeconds` is a boxed Double and is null when no ticket has a
 * `resolvedAt` yet — `MetricsService` returns null rather than 0 for "nothing to average",
 * and the UI has to say so rather than printing a zero.
 *
 * Note what is *not* here: no per-status count for RECEIVED or PROCESSING, and no time
 * series. The four counts below therefore need not add up to `totalTickets`.
 */
export interface MetricsSummary {
  totalTickets: number;
  resolvedAutoCount: number;
  pendingApprovalCount: number;
  escalatedCount: number;
  errorCount: number;
  autonomousResolutionRate: number;
  averageResolutionSeconds: number | null;
}

/** `dto/ErrorResponse.java` */
export interface ApiErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  details: string[];
}
