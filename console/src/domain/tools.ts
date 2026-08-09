import type { JsonObject, JsonValue, TicketCategory } from "@/api/types";
import { formatMoney, moneyAtStake } from "./money";

/**
 * Tool names cross the wire as identifiers — `change_subscription_plan` — because that is what
 * the model calls and what the database stores. An operator deciding whether to move someone's
 * money should not have to read snake_case, so nothing in the UI ever prints a raw name.
 */

interface ToolCopy {
  /** Imperative, sentence case. Answers "what is being proposed?". */
  title: string;
  /** Fills in the actual parameters. Answers "to whom, and how much?". */
  describe: (parameters: JsonObject) => string;
}

const TOOL_COPY: Record<string, ToolCopy> = {
  issue_refund: {
    title: "Issue a refund",
    describe: (parameters) => {
      const money = moneyAtStake(parameters);
      const to = emailOf(parameters);
      if (!money) {
        return to ? `Refund ${to}` : "Issue a refund";
      }
      return to ? `Refund ${formatMoney(money)} to ${to}` : `Refund ${formatMoney(money)}`;
    },
  },
  change_subscription_plan: {
    title: "Change subscription plan",
    describe: (parameters) => {
      const plan = textOf(parameters.targetPlan);
      const to = emailOf(parameters);
      if (!plan) {
        return to ? `Change the plan for ${to}` : "Change subscription plan";
      }
      return to
        ? `Move ${to} to the ${planLabel(plan)} plan`
        : `Move the customer to the ${planLabel(plan)} plan`;
    },
  },
  send_password_reset_link: {
    title: "Send a password reset link",
    describe: (parameters) => {
      const to = emailOf(parameters);
      return to ? `Email a reset link to ${to}` : "Email a password reset link";
    },
  },
  resend_invoice: {
    title: "Resend the latest invoice",
    describe: (parameters) => {
      const to = emailOf(parameters);
      return to ? `Send the most recent invoice to ${to}` : "Send the most recent invoice";
    },
  },
  answer_faq: {
    title: "Reply with a FAQ answer",
    describe: (parameters) => {
      const to = emailOf(parameters);
      return to ? `Answer ${to} from the FAQ` : "Answer from the FAQ";
    },
  },
  escalate_to_human: {
    title: "Escalate to a human",
    describe: (parameters) => {
      const reason = textOf(parameters.reason);
      return reason ? `Hand the ticket to a person: ${reason}` : "Hand the ticket to a person";
    },
  },
};

/**
 * Human-readable title for a tool.
 *
 * A tool added on the Java side and not yet listed above still has to render as something a
 * person can read, so the fallback un-snake-cases the identifier rather than printing it raw.
 */
export function toolTitle(toolName: string): string {
  const known = TOOL_COPY[toolName];
  if (known) {
    return known.title;
  }
  return sentenceCaseIdentifier(toolName);
}

/** One line describing what will happen, with the parameters filled in. */
export function describeAction(toolName: string, parameters: JsonObject | null): string {
  const known = TOOL_COPY[toolName];
  if (known && parameters) {
    return known.describe(parameters);
  }
  return toolTitle(toolName);
}

/** `change_subscription_plan` → `Change subscription plan`. */
export function sentenceCaseIdentifier(identifier: string): string {
  const words = identifier.split(/[_\-\s]+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return identifier;
  }
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** Plan identifiers are lowercase on the wire; the UI capitalises them. */
export function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** Field labels for the parameter table, so the operator does not read camelCase either. */
const PARAMETER_LABELS: Record<string, string> = {
  customerEmail: "Customer",
  targetPlan: "New plan",
  amount: "Amount",
  reason: "Reason",
  query: "Question",
};

export function parameterLabel(key: string): string {
  return PARAMETER_LABELS[key] ?? sentenceCaseIdentifier(key);
}

/** Renders one parameter value for display. Amounts become currency, everything else is text. */
export function parameterValue(key: string, value: JsonValue): string {
  if (key === "amount" && typeof value === "number") {
    return formatMoney({ amount: value, currency: "USD" });
  }
  if (key === "targetPlan" && typeof value === "string") {
    return planLabel(value);
  }
  if (value === null) {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** `TicketCategory` wire values, spelled for people. */
const CATEGORY_LABELS: Record<TicketCategory, string> = {
  password_reset: "Password reset",
  billing_invoice_request: "Invoice request",
  plan_change_request: "Plan change",
  refund_request: "Refund request",
  bug_report: "Bug report",
  feature_request: "Feature request",
  spam_or_abuse: "Spam or abuse",
  unclear: "Unclear",
};

export function categoryLabel(category: TicketCategory | null): string | null {
  if (category === null) {
    return null;
  }
  return CATEGORY_LABELS[category] ?? sentenceCaseIdentifier(category);
}

function emailOf(parameters: JsonObject): string | null {
  return textOf(parameters.customerEmail);
}

function textOf(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
