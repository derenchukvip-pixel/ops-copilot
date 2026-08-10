import { describe, expect, it } from "vitest";
import type { AuditEventType, AuditLogEntry, JsonObject } from "@/api/types";
import { describeAuditEvent } from "./audit";

function entry(eventType: AuditEventType, payload: JsonObject | null): AuditLogEntry {
  return { id: 1, eventType, payload, createdAt: "2026-01-15T10:00:00Z" };
}

const ALL_EVENT_TYPES: AuditEventType[] = [
  "TICKET_RECEIVED",
  "CLASSIFIED",
  "TOOL_CALLED",
  "TOOL_RESULT",
  "ACTION_AUTO_EXECUTED",
  "ACTION_QUEUED_FOR_APPROVAL",
  "ACTION_APPROVED",
  "ACTION_REJECTED",
  "ESCALATED_TO_HUMAN",
  "ERROR",
];

describe("describeAuditEvent", () => {
  it("gives every AuditEventType a human title, never the raw constant", () => {
    for (const eventType of ALL_EVENT_TYPES) {
      const view = describeAuditEvent(entry(eventType, {}));
      expect(view.title).not.toBe(eventType);
      expect(view.title).not.toMatch(/_/);
      expect(view.title.length).toBeGreaterThan(0);
    }
  });

  /*
   * Escalation is the system working as designed — a ticket the agent correctly refused to
   * decide alone. Painting it as a failure would teach operators to treat the one genuinely
   * broken status, ERROR, as noise.
   */
  it("treats escalation as a warning and only ERROR and rejection as negative", () => {
    expect(describeAuditEvent(entry("ESCALATED_TO_HUMAN", {})).tone).toBe("warning");
    expect(describeAuditEvent(entry("ACTION_QUEUED_FOR_APPROVAL", {})).tone).toBe("warning");
    expect(describeAuditEvent(entry("ERROR", {})).tone).toBe("negative");
    expect(describeAuditEvent(entry("ACTION_REJECTED", {})).tone).toBe("negative");
    expect(describeAuditEvent(entry("ACTION_AUTO_EXECUTED", {})).tone).toBe("positive");
    expect(describeAuditEvent(entry("ACTION_APPROVED", {})).tone).toBe("positive");
  });

  it("reads the classification payload the orchestrator writes", () => {
    const view = describeAuditEvent(
      entry("CLASSIFIED", {
        category: "refund_request",
        confidence: 0.91,
        reasoning: "The customer asks for money back.",
      }),
    );
    expect(view.detail).toBe("Refund request · 91% confidence");
    expect(view.reasoning).toBe("The customer asks for money back.");
  });

  it("describes a queued action with its parameters filled in", () => {
    const view = describeAuditEvent(
      entry("ACTION_QUEUED_FOR_APPROVAL", {
        pendingActionId: 2,
        toolName: "issue_refund",
        parameters: { customerEmail: "carol@northwind.example", amount: 249 },
      }),
    );
    expect(view.detail).toBe("Refund $249.00 to carol@northwind.example");
  });

  it("splices the reviewer and the outcome into one sentence", () => {
    expect(
      describeAuditEvent(
        entry("ACTION_APPROVED", {
          pendingActionId: 1,
          reviewedBy: "ops-jane",
          result: "Changed bob@acme.example's plan to pro",
        }),
      ).detail,
    ).toBe("ops-jane approved it — changed bob@acme.example's plan to pro");

    expect(
      describeAuditEvent(
        entry("ACTION_REJECTED", {
          pendingActionId: 1,
          reviewedBy: "ops-jane",
          reason: "The customer never asked for a refund",
        }),
      ).detail,
    ).toBe("ops-jane rejected it — the customer never asked for a refund");
  });

  /*
   * ERROR is written from three call sites with three different key sets: the LLM failure path
   * writes {stage, error}, the validation paths write {stage, toolName, error}, and the failed
   * approval path writes {pendingActionId, toolName, error}. All three have to read.
   */
  it("handles all three shapes of ERROR payload", () => {
    expect(
      describeAuditEvent(entry("ERROR", { stage: "classification", error: "timeout" })).detail,
    ).toBe("classification: timeout");

    expect(
      describeAuditEvent(
        entry("ERROR", { stage: "queue_validation", toolName: "issue_refund", error: "bad amount" }),
      ).detail,
    ).toBe("queue_validation: bad amount");

    expect(
      describeAuditEvent(
        entry("ERROR", { pendingActionId: 7, toolName: "issue_refund", error: "billing down" }),
      ).detail,
    ).toBe("Issue a refund: billing down");
  });

  /* The payload column is nullable, and a corrupt or partial one must not blank the timeline. */
  it("survives null and partial payloads without printing undefined", () => {
    for (const eventType of ALL_EVENT_TYPES) {
      for (const payload of [null, {}, { unexpected: "shape" }] as (JsonObject | null)[]) {
        const view = describeAuditEvent(entry(eventType, payload));
        expect(view.title).toBeTruthy();
        // A null detail is the designed outcome: the timeline shows the title alone. What must
        // never happen is a detail line with the words "undefined" or "null" in it.
        expect(view.detail === null || typeof view.detail === "string").toBe(true);
        if (view.detail !== null) {
          expect(view.detail).not.toMatch(/undefined|null/);
        }
      }
    }
  });

  it("only quotes reasoning for the event that carries it", () => {
    expect(describeAuditEvent(entry("CLASSIFIED", { reasoning: "because" })).reasoning).toBe(
      "because",
    );
    expect(describeAuditEvent(entry("TOOL_RESULT", { reasoning: "because" })).reasoning).toBeNull();
  });
});
