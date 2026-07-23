package dev.artsiom.opscopilot.llm;

/**
 * Thrown when an {@link LlmClient} call fails permanently — after retries are exhausted, or
 * immediately for a non-retryable error (bad request, auth failure). Callers treat this as a
 * signal to record an ERROR audit event and escalate the ticket to a human (FR7).
 */
public class LlmException extends RuntimeException {

    public LlmException(String message, Throwable cause) {
        super(message, cause);
    }

    public LlmException(String message) {
        super(message);
    }
}
