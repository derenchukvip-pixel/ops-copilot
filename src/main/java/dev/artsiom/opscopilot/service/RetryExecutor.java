package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.config.AgentProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Generic retry-with-exponential-backoff for tool calls to the (mock) external systems (FR7).
 * Unlike {@code ClaudeLlmClient}'s retry loop, this has no HTTP status codes to distinguish
 * retryable from non-retryable failures — every {@link RuntimeException} is treated as worth
 * retrying, since a tool call either succeeds or it doesn't; the caller decides what a final
 * failure means for ticket/audit state.
 */
@Component
public class RetryExecutor {

    private static final Logger log = LoggerFactory.getLogger(RetryExecutor.class);

    public <T> RetryOutcome<T> executeWithRetry(AgentProperties.RetryConfig config, String operationName,
                                                 Supplier<T> action) {
        long backoffMs = config.initialBackoffMs();
        RuntimeException lastFailure = null;

        for (int attempt = 1; attempt <= config.maxAttempts(); attempt++) {
            try {
                return new RetryOutcome<>(action.get(), attempt);
            } catch (RuntimeException e) {
                lastFailure = e;
                boolean willRetry = attempt < config.maxAttempts();
                log.warn("{} failed (attempt {}/{}): {}{}", operationName, attempt, config.maxAttempts(),
                        e.getMessage(), willRetry ? ", retrying in " + backoffMs + "ms" : ", giving up");
                if (willRetry) {
                    sleep(backoffMs);
                    backoffMs = (long) (backoffMs * config.backoffMultiplier());
                }
            }
        }

        throw new RetryExhaustedException(operationName + " failed after " + config.maxAttempts() + " attempts",
                lastFailure, config.maxAttempts());
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RetryExhaustedException("Interrupted while backing off before retry", e, 0);
        }
    }

    public record RetryOutcome<T>(T result, int attemptsUsed) {
    }
}
