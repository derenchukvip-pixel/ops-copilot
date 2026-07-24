package dev.artsiom.opscopilot.llm;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Result of asking the model to fill in a specific tool's parameters from the ticket text
 * (second loop iteration, used only for REQUIRES_APPROVAL tools that need more than the
 * customer's email — see AgentOrchestrationService). Token counts feed the same per-run budget
 * guardrail as classification.
 */
public record ParameterExtractionResult(JsonNode parameters, int inputTokens, int outputTokens) {

    public int totalTokens() {
        return inputTokens + outputTokens;
    }
}
