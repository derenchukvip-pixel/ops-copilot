import type { AuditLogEntry, PendingAction, Ticket } from "./types";

/**
 * The demo dataset.
 *
 * These are hand-written fixtures, not a capture of a real Claude run — the console says so
 * in a banner, and the README says so too. What they are *not* is decorative: every record
 * here is shaped exactly like what the backend produces, and the event sequences follow the
 * three scenarios documented in the ops-copilot README (`§ Demo scenarios`) and asserted by
 * `AuditTrailIT`. If a field is null in the fixtures, it is a field the backend can genuinely
 * return as null.
 *
 * Nothing in the demo is a headline number. The dashboard figures are computed from this set
 * by `DemoOpsApi` using the same arithmetic as `MetricsService`, so whatever the tickets below
 * happen to add up to is what the operator sees — there is no tuned "look how good the agent
 * is" percentage anywhere.
 */

/**
 * Minutes before the moment the demo session started. Fractional on purpose: the agent
 * resolves a simple ticket in seconds, and a whole-minute grid would either round that to zero
 * — a ticket received and closed at the same timestamp — or inflate it to a minute it never took.
 */
type MinutesAgo = number;

export interface FixtureAuditEntry extends Omit<AuditLogEntry, "createdAt"> {
  createdAtMinutesAgo: MinutesAgo;
}

export interface FixtureTicket extends Omit<Ticket, "receivedAt" | "resolvedAt" | "createdAt"> {
  receivedAtMinutesAgo: MinutesAgo;
  resolvedAtMinutesAgo: MinutesAgo | null;
  auditLog: FixtureAuditEntry[];
}

export interface FixturePendingAction
  extends Omit<PendingAction, "createdAt" | "reviewedAt"> {
  createdAtMinutesAgo: MinutesAgo;
}

/**
 * Scenario 1 from the README: a password reset, classified with high confidence, resolved by a
 * SAFE tool without a human. Five audit events, no TOOL_CALLED gap.
 */
const passwordReset: FixtureTicket = {
  id: 1,
  externalId: "demo-password-reset-1",
  customerEmail: "alice@acme.example",
  subject: "Forgot my password",
  body: "I cannot log in, please reset my password. I have tried the link on the sign-in page twice and nothing arrives.",
  status: "RESOLVED_AUTO",
  receivedAtMinutesAgo: 184,
  resolvedAtMinutesAgo: 183.95,
  auditLog: [
    {
      id: 1,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 184,
      payload: {
        externalId: "demo-password-reset-1",
        customerEmail: "alice@acme.example",
        subject: "Forgot my password",
      },
    },
    {
      id: 2,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 183.98,
      payload: {
        category: "password_reset",
        confidence: 0.98,
        reasoning:
          "The customer states directly that they cannot log in and asks for a password reset. No billing or account-level change is involved.",
      },
    },
    {
      id: 3,
      eventType: "TOOL_CALLED",
      createdAtMinutesAgo: 183.97,
      payload: {
        toolName: "send_password_reset_link",
        parameters: { customerEmail: "alice@acme.example" },
      },
    },
    {
      id: 4,
      eventType: "TOOL_RESULT",
      createdAtMinutesAgo: 183.96,
      payload: {
        toolName: "send_password_reset_link",
        summary: "Password reset link sent to alice@acme.example",
      },
    },
    {
      id: 5,
      eventType: "ACTION_AUTO_EXECUTED",
      createdAtMinutesAgo: 183.95,
      payload: { toolName: "send_password_reset_link" },
    },
  ],
};

/** Scenario 2 from the README: a plan change waiting on a person. */
const planChange: FixtureTicket = {
  id: 2,
  externalId: "demo-plan-change-1",
  customerEmail: "bob@acme.example",
  subject: "Upgrade my plan",
  body: "We have hired four more people this quarter and keep hitting the seat limit. Please move us to the pro plan.",
  status: "PENDING_APPROVAL",
  receivedAtMinutesAgo: 41,
  resolvedAtMinutesAgo: null,
  auditLog: [
    {
      id: 6,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 41,
      payload: {
        externalId: "demo-plan-change-1",
        customerEmail: "bob@acme.example",
        subject: "Upgrade my plan",
      },
    },
    {
      id: 7,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 41,
      payload: {
        category: "plan_change_request",
        confidence: 0.93,
        reasoning:
          "The customer explicitly names the target plan and gives a reason for the change. The intent is unambiguous.",
      },
    },
    {
      id: 8,
      eventType: "ACTION_QUEUED_FOR_APPROVAL",
      createdAtMinutesAgo: 41,
      payload: {
        pendingActionId: 1,
        toolName: "change_subscription_plan",
        parameters: { customerEmail: "bob@acme.example", targetPlan: "pro" },
      },
    },
  ],
};

/** Scenario 3 from the README: spam escalates without any tool call being attempted. */
const spam: FixtureTicket = {
  id: 3,
  externalId: "demo-spam-1",
  customerEmail: "offers@promo.example",
  subject: "MAKE MONEY FAST",
  body: "Limited time offer, click here for cheap watches and designer bags.",
  status: "ESCALATED",
  receivedAtMinutesAgo: 96,
  resolvedAtMinutesAgo: null,
  auditLog: [
    {
      id: 9,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 96,
      payload: {
        externalId: "demo-spam-1",
        customerEmail: "offers@promo.example",
        subject: "MAKE MONEY FAST",
      },
    },
    {
      id: 10,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 96,
      payload: {
        category: "spam_or_abuse",
        confidence: 0.99,
        reasoning:
          "Unsolicited commercial content with no reference to the product or an existing account.",
      },
    },
    {
      id: 11,
      eventType: "ESCALATED_TO_HUMAN",
      createdAtMinutesAgo: 96,
      payload: { reason: "No automated action for category spam_or_abuse" },
    },
  ],
};

/** A refund the agent understood well. The money path, at high confidence. */
const refundConfident: FixtureTicket = {
  id: 4,
  externalId: "demo-refund-1",
  customerEmail: "carol@northwind.example",
  subject: "Charged twice for January",
  body: "My card was charged 249.00 twice on 3 January for the same invoice. Please refund the duplicate.",
  status: "PENDING_APPROVAL",
  receivedAtMinutesAgo: 23,
  resolvedAtMinutesAgo: null,
  auditLog: [
    {
      id: 12,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 23,
      payload: {
        externalId: "demo-refund-1",
        customerEmail: "carol@northwind.example",
        subject: "Charged twice for January",
      },
    },
    {
      id: 13,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 23,
      payload: {
        category: "refund_request",
        confidence: 0.91,
        reasoning:
          "The customer reports a duplicate charge and asks for money back, naming the amount and the date.",
      },
    },
    {
      id: 14,
      eventType: "ACTION_QUEUED_FOR_APPROVAL",
      createdAtMinutesAgo: 23,
      payload: {
        pendingActionId: 2,
        toolName: "issue_refund",
        parameters: {
          customerEmail: "carol@northwind.example",
          amount: 249.0,
          reason: "Duplicate charge for the January invoice",
        },
      },
    },
  ],
};

/**
 * A refund the agent was *not* confident about.
 *
 * This case exists because it is the one the operator most needs to catch, and because it is
 * easy to assume it cannot happen. `DecisionEngine.decide` returns QueueForApproval for a
 * REQUIRES_APPROVAL tool *before* it ever compares confidence to the threshold — the threshold
 * only gates auto-execution of SAFE tools. So a 0.62-confidence refund is queued exactly like a
 * 0.99 one, and the only thing standing between it and a payout is the person reading this card.
 */
const refundUnsure: FixtureTicket = {
  id: 5,
  externalId: "demo-refund-2",
  customerEmail: "dan@lumen.example",
  subject: "This is not what we agreed",
  body: "The renewal went through at the old rate and nobody told us. We were promised something different on the call in November. Sort this out.",
  status: "PENDING_APPROVAL",
  receivedAtMinutesAgo: 8,
  resolvedAtMinutesAgo: null,
  auditLog: [
    {
      id: 15,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 8,
      payload: {
        externalId: "demo-refund-2",
        customerEmail: "dan@lumen.example",
        subject: "This is not what we agreed",
      },
    },
    {
      id: 16,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 8,
      payload: {
        category: "refund_request",
        confidence: 0.62,
        reasoning:
          "The customer is disputing a renewal charge but never asks for a refund in so many words, and refers to a phone call the agent cannot see. The intent may equally be a plan change or a complaint.",
      },
    },
    {
      id: 17,
      eventType: "ACTION_QUEUED_FOR_APPROVAL",
      createdAtMinutesAgo: 8,
      payload: {
        pendingActionId: 3,
        toolName: "issue_refund",
        parameters: {
          customerEmail: "dan@lumen.example",
          amount: 1200.0,
          reason: "Renewal charged at a rate the customer disputes",
        },
      },
    },
  ],
};

/** A second SAFE-tool resolution, so the autonomous rate is not computed from a single ticket. */
const invoiceRequest: FixtureTicket = {
  id: 6,
  externalId: "demo-invoice-1",
  customerEmail: "erin@acme.example",
  subject: "Copy of last invoice for accounting",
  body: "Could you send the most recent invoice again? Our accountant needs it for the quarter.",
  status: "RESOLVED_AUTO",
  receivedAtMinutesAgo: 132,
  resolvedAtMinutesAgo: 131.92,
  auditLog: [
    {
      id: 18,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 132,
      payload: {
        externalId: "demo-invoice-1",
        customerEmail: "erin@acme.example",
        subject: "Copy of last invoice for accounting",
      },
    },
    {
      id: 19,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 131.97,
      payload: {
        category: "billing_invoice_request",
        confidence: 0.96,
        reasoning:
          "A straightforward request for a copy of an existing invoice. Nothing about the account changes.",
      },
    },
    {
      id: 20,
      eventType: "TOOL_CALLED",
      createdAtMinutesAgo: 131.95,
      payload: {
        toolName: "resend_invoice",
        parameters: { customerEmail: "erin@acme.example" },
      },
    },
    {
      id: 21,
      eventType: "TOOL_RESULT",
      createdAtMinutesAgo: 131.93,
      payload: { toolName: "resend_invoice", summary: "Invoice INV-2043 sent to erin@acme.example" },
    },
    {
      id: 22,
      eventType: "ACTION_AUTO_EXECUTED",
      createdAtMinutesAgo: 131.92,
      payload: { toolName: "resend_invoice" },
    },
  ],
};

/** A bug report: no tool is mapped to the category at all, so it escalates untouched. */
const bugReport: FixtureTicket = {
  id: 7,
  externalId: "demo-bug-1",
  customerEmail: "frank@acme.example",
  subject: "Export produces an empty file",
  body: "Exporting a report with more than about 5000 rows downloads a zero-byte CSV. Smaller exports are fine.",
  status: "ESCALATED",
  receivedAtMinutesAgo: 57,
  resolvedAtMinutesAgo: null,
  auditLog: [
    {
      id: 23,
      eventType: "TICKET_RECEIVED",
      createdAtMinutesAgo: 57,
      payload: {
        externalId: "demo-bug-1",
        customerEmail: "frank@acme.example",
        subject: "Export produces an empty file",
      },
    },
    {
      id: 24,
      eventType: "CLASSIFIED",
      createdAtMinutesAgo: 57,
      payload: {
        category: "bug_report",
        confidence: 0.94,
        reasoning:
          "The customer describes reproducible incorrect behaviour with a size threshold. This needs an engineer, not an account action.",
      },
    },
    {
      id: 25,
      eventType: "ESCALATED_TO_HUMAN",
      createdAtMinutesAgo: 57,
      payload: { reason: "No automated action for category bug_report" },
    },
  ],
};

export const FIXTURE_TICKETS: FixtureTicket[] = [
  passwordReset,
  planChange,
  spam,
  refundConfident,
  refundUnsure,
  invoiceRequest,
  bugReport,
];

/**
 * The queue. `reviewedBy`, `reviewedAt` and `reason` are null on every PENDING row — the backend
 * only fills them on the transition, and the fixtures do not pretend otherwise.
 */
export const FIXTURE_PENDING_ACTIONS: FixturePendingAction[] = [
  {
    id: 1,
    ticketId: 2,
    customerEmail: "bob@acme.example",
    subject: "Upgrade my plan",
    toolName: "change_subscription_plan",
    parameters: { customerEmail: "bob@acme.example", targetPlan: "pro" },
    status: "PENDING",
    category: "plan_change_request",
    confidence: 0.93,
    reasoning:
      "The customer explicitly names the target plan and gives a reason for the change. The intent is unambiguous.",
    reviewedBy: null,
    reason: null,
    createdAtMinutesAgo: 41,
  },
  {
    id: 2,
    ticketId: 4,
    customerEmail: "carol@northwind.example",
    subject: "Charged twice for January",
    toolName: "issue_refund",
    parameters: {
      customerEmail: "carol@northwind.example",
      amount: 249.0,
      reason: "Duplicate charge for the January invoice",
    },
    status: "PENDING",
    category: "refund_request",
    confidence: 0.91,
    reasoning:
      "The customer reports a duplicate charge and asks for money back, naming the amount and the date.",
    reviewedBy: null,
    reason: null,
    createdAtMinutesAgo: 23,
  },
  {
    id: 3,
    ticketId: 5,
    customerEmail: "dan@lumen.example",
    subject: "This is not what we agreed",
    toolName: "issue_refund",
    parameters: {
      customerEmail: "dan@lumen.example",
      amount: 1200.0,
      reason: "Renewal charged at a rate the customer disputes",
    },
    status: "PENDING",
    category: "refund_request",
    confidence: 0.62,
    reasoning:
      "The customer is disputing a renewal charge but never asks for a refund in so many words, and refers to a phone call the agent cannot see. The intent may equally be a plan change or a complaint.",
    reviewedBy: null,
    reason: null,
    createdAtMinutesAgo: 8,
  },
];

/** Highest fixture audit id, so appended events continue the sequence instead of colliding. */
export const FIXTURE_MAX_AUDIT_ID = 25;
