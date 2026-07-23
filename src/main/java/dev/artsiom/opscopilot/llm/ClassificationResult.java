package dev.artsiom.opscopilot.llm;

/**
 * Classification plus the token counts the call consumed. Token counts feed the per-run cost
 * budget guardrail (FR8) — the orchestrator accumulates these across every LLM call in a run.
 */
public record ClassificationResult(TicketClassification classification, int inputTokens, int outputTokens) {

    public int totalTokens() {
        return inputTokens + outputTokens;
    }
}
