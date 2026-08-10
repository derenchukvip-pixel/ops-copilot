import type { AuditEventType, AuditLogEntry, JsonObject, JsonValue, TicketCategory } from "@/api/types";
import { formatConfidence } from "./format";
import { categoryLabel, describeAction, toolTitle } from "./tools";

/**
 * The audit log is the most valuable thing the backend produces and the least readable: ten
 * enum constants and a free-form JSON blob per row. This module is the translation layer —
 * each event becomes a sentence a support lead can read without knowing the codebase.
 *
 * Payload keys are read defensively throughout. The column is JSON, the shapes differ per
 * event (an ERROR from parameter extraction carries different keys than one from a failed
 * tool execution), and a missing key must degrade to a shorter sentence, never to "undefined".
 */

export type Tone = "positive" | "warning" | "neutral" | "negative";

export interface AuditEventView {
  /** What happened, in four words or fewer. */
  title: string;
  /** The detail that makes the event worth reading. Null when the payload adds nothing. */
  detail: string | null;
  /** The model's own words, shown as a quote rather than folded into the detail line. */
  reasoning: string | null;
  tone: Tone;
}

const TITLES: Record<AuditEventType, string> = {
  TICKET_RECEIVED: "Ticket received",
  CLASSIFIED: "Agent classified the ticket",
  TOOL_CALLED: "Agent called a tool",
  TOOL_RESULT: "Tool finished",
  ACTION_AUTO_EXECUTED: "Resolved without a human",
  ACTION_QUEUED_FOR_APPROVAL: "Sent to the approval queue",
  ACTION_APPROVED: "Approved by an operator",
  ACTION_REJECTED: "Rejected by an operator",
  ESCALATED_TO_HUMAN: "Escalated to a human",
  ERROR: "Something went wrong",
};

/**
 * Colour carries state and only state. Note that ESCALATED_TO_HUMAN is warning rather than
 * negative: handing a ticket to a person is the system working as designed, not a failure.
 */
const TONES: Record<AuditEventType, Tone> = {
  TICKET_RECEIVED: "neutral",
  CLASSIFIED: "neutral",
  TOOL_CALLED: "neutral",
  TOOL_RESULT: "positive",
  ACTION_AUTO_EXECUTED: "positive",
  ACTION_QUEUED_FOR_APPROVAL: "warning",
  ACTION_APPROVED: "positive",
  ACTION_REJECTED: "negative",
  ESCALATED_TO_HUMAN: "warning",
  ERROR: "negative",
};

export function describeAuditEvent(entry: AuditLogEntry): AuditEventView {
  const payload = entry.payload ?? {};
  const title = TITLES[entry.eventType] ?? entry.eventType;
  const tone = TONES[entry.eventType] ?? "neutral";

  return {
    title,
    tone,
    detail: detailFor(entry.eventType, payload),
    reasoning: entry.eventType === "CLASSIFIED" ? str(payload.reasoning) : null,
  };
}

function detailFor(eventType: AuditEventType, payload: JsonObject): string | null {
  switch (eventType) {
    case "TICKET_RECEIVED": {
      const from = str(payload.customerEmail);
      return from ? `From ${from}` : null;
    }

    case "CLASSIFIED": {
      const category = categoryLabel(str(payload.category) as TicketCategory | null);
      const confidence = num(payload.confidence);
      if (category && confidence !== null) {
        return `${category} · ${formatConfidence(confidence)} confidence`;
      }
      return category ?? (confidence !== null ? `${formatConfidence(confidence)} confidence` : null);
    }

    case "TOOL_CALLED":
    case "ACTION_QUEUED_FOR_APPROVAL": {
      const toolName = str(payload.toolName);
      if (!toolName) {
        return null;
      }
      const parameters = obj(payload.parameters);
      return describeAction(toolName, parameters);
    }

    case "TOOL_RESULT":
      return str(payload.summary);

    case "ACTION_AUTO_EXECUTED": {
      const toolName = str(payload.toolName);
      return toolName ? toolTitle(toolName) : null;
    }

    case "ACTION_APPROVED": {
      const by = str(payload.reviewedBy);
      const result = str(payload.result);
      if (by && result) {
        return `${by} approved it — ${lowerFirst(result)}`;
      }
      return result ?? (by ? `Approved by ${by}` : null);
    }

    case "ACTION_REJECTED": {
      const by = str(payload.reviewedBy);
      const reason = str(payload.reason);
      if (by && reason) {
        return `${by} rejected it — ${lowerFirst(reason)}`;
      }
      return reason ?? (by ? `Rejected by ${by}` : null);
    }

    case "ESCALATED_TO_HUMAN":
      return str(payload.reason);

    case "ERROR": {
      // Three different call sites write ERROR with three different key sets.
      const stage = str(payload.stage);
      const toolName = str(payload.toolName);
      const error = str(payload.error);
      const where = stage ?? (toolName ? toolTitle(toolName) : null);
      if (where && error) {
        return `${where}: ${error}`;
      }
      return error ?? where;
    }

    default:
      return null;
  }
}

function str(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function num(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function obj(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

/**
 * Tool summaries start with a capital ("Refunded 249.00 to …") and get spliced mid-sentence
 * after an em dash, where a capital reads as a new sentence starting.
 */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
