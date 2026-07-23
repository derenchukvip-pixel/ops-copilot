package dev.artsiom.opscopilot.llm;

/**
 * The system prompt and tool schema for FR2 classification. Kept as one file so the prompt and
 * the schema the model is forced to fill in stay next to each other — changing one usually
 * means changing the other.
 */
final class ClassificationPrompt {

    static final String TOOL_NAME = "classify_ticket";

    static final String SYSTEM_PROMPT = """
            You are the triage classifier for a B2B SaaS support inbox. You will be shown the \
            subject and body of one incoming customer support ticket. Call the classify_ticket \
            tool exactly once with your classification.

            Categories:
            - password_reset: the customer is locked out or asking to reset their password.
            - billing_invoice_request: the customer wants a copy of an invoice or receipt.
            - plan_change_request: the customer wants to upgrade, downgrade, or change their \
              subscription plan.
            - refund_request: the customer is asking for money back.
            - bug_report: the customer describes something in the product not working as expected.
            - feature_request: the customer is asking for new functionality that doesn't exist.
            - spam_or_abuse: unsolicited advertising, abusive language, or clearly not a genuine \
              support request.
            - unclear: the intent doesn't fit cleanly into any category above, or the message is \
              too vague to classify confidently.

            Guidance on confidence:
            - Use confidence >= 0.85 only when the intent is unambiguous from the text alone.
            - Use a lower confidence when the ticket could plausibly belong to more than one \
              category, references something you cannot verify, or is terse/ambiguous.
            - Never inflate confidence to avoid the unclear category — an honest 0.4 with \
              unclear is far more useful downstream than a false 0.9.
            - reasoning must be one or two sentences that would make sense to a human auditor \
              reading it months later with no other context — cite the specific words in the \
              ticket that drove your decision.
            """;

    static final String INPUT_SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "category": {
                  "type": "string",
                  "enum": [
                    "password_reset",
                    "billing_invoice_request",
                    "plan_change_request",
                    "refund_request",
                    "bug_report",
                    "feature_request",
                    "spam_or_abuse",
                    "unclear"
                  ],
                  "description": "The single best-fitting category for this ticket."
                },
                "confidence": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "description": "How confident you are in this category, from 0 (guessing) to 1 (certain)."
                },
                "reasoning": {
                  "type": "string",
                  "description": "One or two sentences citing the specific evidence in the ticket text."
                }
              },
              "required": ["category", "confidence", "reasoning"]
            }
            """;

    private ClassificationPrompt() {
    }

    static String userMessage(String subject, String body) {
        return "Subject: " + subject + "\n\nBody:\n" + body;
    }
}
