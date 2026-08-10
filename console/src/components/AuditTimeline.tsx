import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Hourglass,
  Inbox,
  Tag,
  UserRound,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AuditEventType, AuditLogEntry } from "@/api/types";
import { describeAuditEvent, type Tone } from "@/domain/audit";
import { formatAbsoluteTime, formatClockTime } from "@/domain/format";

/** One icon set across the whole console — mixing sets is the fastest way to look assembled. */
const ICONS: Record<AuditEventType, ComponentType<{ className?: string }>> = {
  TICKET_RECEIVED: Inbox,
  CLASSIFIED: Tag,
  TOOL_CALLED: Wrench,
  TOOL_RESULT: Check,
  ACTION_AUTO_EXECUTED: Zap,
  ACTION_QUEUED_FOR_APPROVAL: Hourglass,
  ACTION_APPROVED: CheckCircle2,
  ACTION_REJECTED: XCircle,
  ESCALATED_TO_HUMAN: UserRound,
  ERROR: AlertTriangle,
};

const TONE_MARKER: Record<Tone, string> = {
  positive: "border-positive/30 bg-positive-tint text-positive",
  warning: "border-warning/30 bg-warning-tint text-warning",
  neutral: "border-line bg-neutral-tint text-neutral",
  negative: "border-negative/30 bg-negative-tint text-negative",
};

/**
 * The audit trail as a vertical timeline.
 *
 * This is the screen that makes the agent auditable rather than merely logged: ten enum
 * constants and a JSON column become a sequence a support lead can read top to bottom and say
 * what the system did and why. The raw payloads stay available at the bottom of the page for
 * whoever wants to check the translation.
 */
export function AuditTimeline({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <ol className="relative flex flex-col">
      {entries.map((entry, index) => {
        const view = describeAuditEvent(entry);
        const Icon = ICONS[entry.eventType] ?? Tag;
        const isLast = index === entries.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* The connector stops at the last event so the timeline does not trail into nothing. */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute top-10 bottom-0 left-5 w-px -translate-x-1/2 bg-line"
              />
            ) : null}

            <span
              aria-hidden="true"
              className={[
                "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border",
                TONE_MARKER[view.tone],
              ].join(" ")}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-body font-semibold text-ink">{view.title}</h3>
                <time
                  dateTime={entry.createdAt}
                  title={formatAbsoluteTime(entry.createdAt)}
                  className="text-caption tabular-nums text-ink-muted"
                >
                  {formatClockTime(entry.createdAt)}
                </time>
              </div>

              {view.detail ? (
                <p className="mt-1 text-body break-words text-ink-muted">{view.detail}</p>
              ) : null}

              {view.reasoning ? (
                <blockquote className="mt-2 border-l-2 border-line pl-4 text-body text-ink">
                  {view.reasoning}
                </blockquote>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
