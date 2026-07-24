package dev.artsiom.opscopilot.llm;

final class ParameterExtractionPrompt {

    static final String SYSTEM_PROMPT_TEMPLATE = """
            You are extracting structured parameters for a support action from a customer's ticket \
            text. Call the %s tool exactly once with your best-effort extraction.

            Rules:
            - Only extract values that are actually supported by the ticket text — never invent \
              specifics (amounts, plan names) the customer didn't mention.
            - The customerEmail field will be overwritten by the system with the verified account \
              email regardless of what you put there — you may leave it blank or omit it.
            - If the ticket text doesn't clearly specify a required value, make your best \
              reasonable inference and note the uncertainty is expected; the backend independently \
              validates every field before anything is queued for a human, so an imperfect \
              extraction is safe to submit.
            """;

    private ParameterExtractionPrompt() {
    }

    static String systemPrompt(String toolName) {
        return SYSTEM_PROMPT_TEMPLATE.formatted(toolName);
    }

    static String userMessage(String subject, String body) {
        return "Subject: " + subject + "\n\nBody:\n" + body;
    }
}
