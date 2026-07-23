package dev.artsiom.opscopilot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

/**
 * Guardrail knobs (FR3, FR8). Bound from {@code ops-copilot.agent.*} in application.yml —
 * these are the numbers an Admin would tune per the ТЗ's role definitions, kept out of code
 * so a threshold change never requires a redeploy of the JAR, only a config change.
 */
@ConfigurationProperties(prefix = "ops-copilot.agent")
public record AgentProperties(
        BigDecimal confidenceThreshold,
        int maxIterations,
        long maxTokenBudget,
        RetryConfig llmRetry,
        RetryConfig toolRetry
) {

    public record RetryConfig(int maxAttempts, long initialBackoffMs, double backoffMultiplier) {
    }
}
