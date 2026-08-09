/**
 * Formatting helpers. All of them take the "now" they measure against as an argument rather
 * than reading the clock, so they are testable and so a list of timestamps is measured against
 * a single instant instead of drifting row by row.
 */

/** `0.93` → `"93%"`. Confidence is a probability on the wire and a percentage on screen. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** `0.2857…` → `"29%"`. Same rounding as confidence, so the two never disagree visually. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Short relative time for list rows: "just now", "12 min ago", "3 h ago", "2 d ago".
 *
 * Anything older than a week falls back to a date, because "38 d ago" is a number nobody
 * converts in their head.
 */
export function formatRelativeTime(isoTimestamp: string, now: Date = new Date()): string {
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) {
    return "unknown time";
  }

  const seconds = Math.floor((now.getTime() - then) / 1000);

  if (seconds < 0) {
    return "just now";
  }
  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days <= 7) {
    return `${days} d ago`;
  }

  return formatAbsoluteDate(isoTimestamp);
}

/** Full timestamp for tooltips and the audit timeline, in the reader's own locale. */
export function formatAbsoluteTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatAbsoluteDate(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Clock time only — the audit timeline already groups by ticket, so the date is repetition. */
export function formatClockTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }
  return parsed.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * `averageResolutionSeconds` from the metrics endpoint. Sub-minute values keep one decimal
 * because the interesting claim about this agent is that it answers in seconds — rounding
 * 3.4 s to "3 s" throws away the part worth showing.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  if (seconds < 60) {
    const rounded = Math.round(seconds * 10) / 10;
    return `${rounded} s`;
  }

  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (totalMinutes < 60) {
    return remainingSeconds === 0
      ? `${totalMinutes} min`
      : `${totalMinutes} min ${remainingSeconds} s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
