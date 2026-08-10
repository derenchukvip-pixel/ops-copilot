import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  describeAction,
  parameterLabel,
  parameterValue,
  planLabel,
  sentenceCaseIdentifier,
  toolTitle,
} from "./tools";

describe("toolTitle", () => {
  it("names every tool the backend registers", () => {
    // The full set from src/main/java/dev/artsiom/opscopilot/tools.
    expect(toolTitle("issue_refund")).toBe("Issue a refund");
    expect(toolTitle("change_subscription_plan")).toBe("Change subscription plan");
    expect(toolTitle("send_password_reset_link")).toBe("Send a password reset link");
    expect(toolTitle("resend_invoice")).toBe("Resend the latest invoice");
    expect(toolTitle("answer_faq")).toBe("Reply with a FAQ answer");
    expect(toolTitle("escalate_to_human")).toBe("Escalate to a human");
  });

  /*
   * A tool added on the Java side ships to this console before anyone writes copy for it.
   * The failure mode must be a readable phrase, not `apply_account_credit` in the middle of a
   * sentence an operator is meant to act on.
   */
  it("falls back to a readable phrase for a tool it has never seen", () => {
    expect(toolTitle("apply_account_credit")).toBe("Apply account credit");
    expect(toolTitle("cancel")).toBe("Cancel");
  });

  it("never returns an empty string", () => {
    expect(toolTitle("")).toBe("");
    expect(toolTitle("__")).toBe("__");
  });
});

describe("sentenceCaseIdentifier", () => {
  it("capitalises only the first word", () => {
    expect(sentenceCaseIdentifier("change_subscription_plan")).toBe("Change subscription plan");
    expect(sentenceCaseIdentifier("password-reset")).toBe("Password reset");
    expect(sentenceCaseIdentifier("already spaced")).toBe("Already spaced");
  });

  it("collapses repeated separators", () => {
    expect(sentenceCaseIdentifier("a__b--c")).toBe("A b c");
  });
});

describe("describeAction", () => {
  it("fills in the parameters that matter for a refund", () => {
    expect(
      describeAction("issue_refund", {
        customerEmail: "carol@northwind.example",
        amount: 249,
        reason: "Duplicate charge",
      }),
    ).toBe("Refund $249.00 to carol@northwind.example");
  });

  it("names the target plan in words, not as a wire value", () => {
    expect(
      describeAction("change_subscription_plan", {
        customerEmail: "bob@acme.example",
        targetPlan: "pro",
      }),
    ).toBe("Move bob@acme.example to the Pro plan");
  });

  it("degrades to a shorter sentence when a parameter is missing", () => {
    expect(describeAction("issue_refund", { customerEmail: "carol@northwind.example" })).toBe(
      "Refund carol@northwind.example",
    );
    expect(describeAction("issue_refund", { amount: 50 })).toBe("Refund $50.00");
    expect(describeAction("issue_refund", {})).toBe("Issue a refund");
    expect(describeAction("change_subscription_plan", {})).toBe("Change subscription plan");
  });

  it("falls back to the tool title when there are no parameters at all", () => {
    expect(describeAction("issue_refund", null)).toBe("Issue a refund");
    expect(describeAction("apply_account_credit", null)).toBe("Apply account credit");
  });

  it("ignores blank strings the way a missing field is ignored", () => {
    expect(describeAction("change_subscription_plan", { customerEmail: "  ", targetPlan: "pro" })).toBe(
      "Move the customer to the Pro plan",
    );
  });
});

describe("parameterValue", () => {
  it("formats an amount as currency and a plan as a label", () => {
    expect(parameterValue("amount", 1200)).toBe("$1,200.00");
    expect(parameterValue("targetPlan", "business")).toBe("Business");
  });

  it("passes other values through as text", () => {
    expect(parameterValue("customerEmail", "a@b.example")).toBe("a@b.example");
    expect(parameterValue("reason", "Duplicate charge")).toBe("Duplicate charge");
    expect(parameterValue("anything", null)).toBe("—");
    expect(parameterValue("nested", { a: 1 })).toBe('{"a":1}');
  });
});

describe("parameterLabel", () => {
  it("replaces camelCase keys with words", () => {
    expect(parameterLabel("customerEmail")).toBe("Customer");
    expect(parameterLabel("targetPlan")).toBe("New plan");
    expect(parameterLabel("somethingNew")).toBe("SomethingNew");
  });
});

describe("categoryLabel", () => {
  it("covers every TicketCategory wire value", () => {
    expect(categoryLabel("password_reset")).toBe("Password reset");
    expect(categoryLabel("billing_invoice_request")).toBe("Invoice request");
    expect(categoryLabel("plan_change_request")).toBe("Plan change");
    expect(categoryLabel("refund_request")).toBe("Refund request");
    expect(categoryLabel("bug_report")).toBe("Bug report");
    expect(categoryLabel("feature_request")).toBe("Feature request");
    expect(categoryLabel("spam_or_abuse")).toBe("Spam or abuse");
    expect(categoryLabel("unclear")).toBe("Unclear");
  });

  /* The field is null whenever no AgentDecision row exists for the ticket. */
  it("returns null when the ticket has no classification", () => {
    expect(categoryLabel(null)).toBeNull();
  });
});

describe("planLabel", () => {
  it("capitalises the four plans the tool schema allows", () => {
    expect(["starter", "pro", "business", "enterprise"].map(planLabel)).toEqual([
      "Starter",
      "Pro",
      "Business",
      "Enterprise",
    ]);
  });
});
