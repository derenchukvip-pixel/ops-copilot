package dev.artsiom.opscopilot.llm;

import com.fasterxml.jackson.databind.JsonNode;

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

    /**
     * Asks the model to fill in a specific tool's parameters from the ticket text — the agent
     * loop's second iteration, used only when a decision needs more than the ticket's own fields
     * (e.g. a target plan name, a refund amount). Same retry/error contract as
     * {@link #classifyTicket}.
     */
    ParameterExtractionResult extractParameters(String subject, String body, String toolName,
                                                 String toolDescription, JsonNode inputSchema);
}
