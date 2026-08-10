import { describe, expect, it } from "vitest";
import {
  formatConfidence,
  formatDuration,
  formatPercent,
  formatRelativeTime,
} from "./format";
import { parseTicketId } from "./tickets";

const NOW = new Date("2026-01-15T12:00:00Z");

function minutesBefore(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("formatRelativeTime", () => {
  it("uses the coarsest unit that still reads precisely", () => {
    expect(formatRelativeTime(minutesBefore(0), NOW)).toBe("just now");
    expect(formatRelativeTime(minutesBefore(0.5), NOW)).toBe("just now");
    expect(formatRelativeTime(minutesBefore(1), NOW)).toBe("1 min ago");
    expect(formatRelativeTime(minutesBefore(59), NOW)).toBe("59 min ago");
    expect(formatRelativeTime(minutesBefore(60), NOW)).toBe("1 h ago");
    expect(formatRelativeTime(minutesBefore(60 * 23), NOW)).toBe("23 h ago");
    expect(formatRelativeTime(minutesBefore(60 * 24), NOW)).toBe("1 d ago");
    expect(formatRelativeTime(minutesBefore(60 * 24 * 7), NOW)).toBe("7 d ago");
  });

  /* "38 d ago" is a number nobody converts in their head. */
  it("switches to a date beyond a week", () => {
    expect(formatRelativeTime(minutesBefore(60 * 24 * 40), NOW)).not.toMatch(/ago/);
  });

  /* Clock skew between the server and the operator's machine must not print "-3 min ago". */
  it("does not produce a negative age for a future timestamp", () => {
    expect(formatRelativeTime(minutesBefore(-5), NOW)).toBe("just now");
  });

  it("says so rather than printing NaN for an unparseable value", () => {
    expect(formatRelativeTime("not a date", NOW)).toBe("unknown time");
  });
});

describe("formatDuration", () => {
  /*
   * Sub-minute resolution keeps one decimal: the interesting claim about this agent is that it
   * answers in seconds, and rounding 3.4 s to "3 s" throws away the part worth showing.
   */
  it("keeps one decimal below a minute", () => {
    expect(formatDuration(3.42)).toBe("3.4 s");
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(59.9)).toBe("59.9 s");
  });

  it("switches to minutes and hours as the value grows", () => {
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(214)).toBe("3 min 34 s");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(3660)).toBe("1 h 1 min");
  });

  it("returns a dash rather than a number for nonsense input", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});

describe("formatConfidence and formatPercent", () => {
  it("round the same way, so a rate and a confidence never disagree on screen", () => {
    expect(formatConfidence(0.925)).toBe(formatPercent(0.925));
    expect(formatConfidence(0.62)).toBe("62%");
    expect(formatPercent(2 / 7)).toBe("29%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("parseTicketId", () => {
  it("accepts a positive integer with surrounding whitespace", () => {
    expect(parseTicketId("4")).toBe(4);
    expect(parseTicketId("  12  ")).toBe(12);
  });

  it("rejects anything that is not a ticket id", () => {
    expect(parseTicketId("")).toBeNull();
    expect(parseTicketId("0")).toBeNull();
    expect(parseTicketId("-3")).toBeNull();
    expect(parseTicketId("1.5")).toBeNull();
    expect(parseTicketId("4a")).toBeNull();
    expect(parseTicketId("../admin")).toBeNull();
    expect(parseTicketId("99999999999999999999")).toBeNull();
  });
});
