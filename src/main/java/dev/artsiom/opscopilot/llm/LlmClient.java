package dev.artsiom.opscopilot.llm;

/**
 * Abstraction over the LLM provider used for ticket classification (FR2). Kept as an interface
 * so the orchestration layer never depends on the Anthropic wire format directly — swapping in
 * an OpenAI-backed implementation later means adding a class, not touching the agent loop.
 */
public interface LlmClient {

    /**
     * Classifies a ticket's intent. Implementations are responsible for their own retry/backoff
     * (FR7) and must throw {@link LlmException} once retries are exhausted or the provider
     * returns a non-retryable error — callers treat that as "the LLM step failed" and escalate.
     * The returned token counts feed the per-run cost budget guardrail (FR8).
     */
    ClassificationResult classifyTicket(String subject, String body);
}
