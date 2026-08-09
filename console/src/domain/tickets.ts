import type { TicketStatus } from "@/api/types";
import type { Tone } from "./audit";

interface StatusView {
  label: string;
  tone: Tone;
  /** One line on what the status means for whoever is reading the ticket. */
  meaning: string;
}

/**
 * `TicketStatus` for people.
 *
 * ESCALATED is warning rather than negative on purpose: a ticket reaching a human is the
 * designed outcome for anything the agent should not decide, not a failure. ERROR is the only
 * status that means something actually broke.
 */
const STATUS_VIEWS: Record<TicketStatus, StatusView> = {
  RECEIVED: {
    label: "Received",
    tone: "neutral",
    meaning: "Accepted, not yet looked at by the agent.",
  },
  PROCESSING: {
    label: "Processing",
    tone: "neutral",
    meaning: "The agent is working through it right now.",
  },
  RESOLVED_AUTO: {
    label: "Resolved",
    tone: "positive",
    meaning: "Closed by an executed action — either automatically or after an approval.",
  },
  PENDING_APPROVAL: {
    label: "Waiting for approval",
    tone: "warning",
    meaning: "The agent proposed something it is not allowed to do alone. It is in the queue.",
  },
  ESCALATED: {
    label: "With a human",
    tone: "warning",
    meaning: "The agent stopped and handed the ticket over. No automated action was taken.",
  },
  ERROR: {
    label: "Error",
    tone: "negative",
    meaning: "Processing failed. The audit log below says at which step.",
  },
};

export function ticketStatusView(status: TicketStatus): StatusView {
  return (
    STATUS_VIEWS[status] ?? {
      label: status,
      tone: "neutral" as const,
      meaning: "Unrecognised status.",
    }
  );
}

/**
 * Parses the ticket id a person typed. Ids are database identities — positive integers — so
 * anything else is a typo worth naming rather than a request worth sending.
 */
export function parseTicketId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
