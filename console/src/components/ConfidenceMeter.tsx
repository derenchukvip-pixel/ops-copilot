import { formatConfidence } from "@/domain/format";

/**
 * The agent's confidence threshold, from `ops-copilot.agent.confidence-threshold` in
 * `application.yml`. Below it, a SAFE tool would not have run at all — the ticket would have
 * escalated instead.
 */
export const CONFIDENCE_THRESHOLD = 0.85;

interface ConfidenceMeterProps {
  confidence: number | null;
}

/**
 * Confidence, as a figure and a bar.
 *
 * Why the low-confidence case is worth flagging loudly: `DecisionEngine.decide` returns
 * QueueForApproval for a REQUIRES_APPROVAL tool *before* it compares confidence to the
 * threshold. The threshold only ever gates automatic execution of safe tools. So an action can
 * — and does — reach this queue at 0.62, looking exactly like one at 0.99, and the person
 * reading the card is the only thing that catches it.
 */
export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  if (confidence === null) {
    return (
      <div>
        <div className="label-caps text-ink-muted">Confidence</div>
        <p className="mt-1 text-body text-ink-muted">
          Not recorded. No classification is stored for this ticket.
        </p>
      </div>
    );
  }

  const belowThreshold = confidence < CONFIDENCE_THRESHOLD;
  const percent = Math.max(0, Math.min(100, confidence * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="label-caps text-ink-muted">Confidence</span>
        <span
          className={[
            "text-title tabular-nums",
            belowThreshold ? "text-warning" : "text-ink",
          ].join(" ")}
        >
          {formatConfidence(confidence)}
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Classification confidence"
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-200 ease-in-out",
            belowThreshold ? "bg-warning" : "bg-brand-bright",
          ].join(" ")}
          style={{ width: `${percent}%` }}
        />
      </div>

      {belowThreshold ? (
        // Colour alone would not carry this, and it is the single most important sentence on
        // the card when it applies.
        <p className="mt-2 text-caption text-warning">
          Below the {formatConfidence(CONFIDENCE_THRESHOLD)} threshold. The agent was unsure what
          this ticket was asking for, and queued the action anyway because the tool always needs
          approval. Read the ticket before deciding.
        </p>
      ) : null}
    </div>
  );
}
