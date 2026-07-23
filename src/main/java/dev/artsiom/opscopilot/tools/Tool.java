package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * A single agent capability (FR4). Every implementation is registered as a Spring bean and
 * picked up by {@link ToolRegistry} — there is no other way for the orchestrator to reach a
 * tool, which is what makes the allowlist in FR8 real rather than a comment.
 */
public interface Tool {

    /** Stable identifier used in ToolCall/PendingAction rows and in the LLM-facing schema. */
    String name();

    RiskTier riskTier();

    /** Shown to the model as the function-calling tool description. */
    String description();

    /** JSON Schema for this tool's parameters, in Anthropic tool-use format. */
    JsonNode inputSchema();

    /**
     * Validates {@code parameters} against this tool's contract. Called before every execution
     * — for SAFE tools immediately before {@link #execute}, for REQUIRES_APPROVAL tools both at
     * proposal time (before queuing) and again at approval time (defense in depth against state
     * that went stale while the action sat in the queue). Throws {@link ToolValidationException}
     * on any violation; never silently coerces bad input.
     */
    void validateParameters(JsonNode parameters);

    /**
     * Performs the actual (mocked) side effect. Callers must have called
     * {@link #validateParameters} first — this method does not re-validate.
     */
    ToolExecutionResult execute(JsonNode parameters);
}
