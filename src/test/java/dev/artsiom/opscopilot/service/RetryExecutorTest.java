package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.config.AgentProperties;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** FR7: exponential backoff, 3 attempts, escalate on exhaustion — as a unit, not just a comment. */
class RetryExecutorTest {

    private static final AgentProperties.RetryConfig CONFIG = new AgentProperties.RetryConfig(3, 1, 2.0);

    private final RetryExecutor retryExecutor = new RetryExecutor();

    @Test
    void succeedsOnFirstAttemptWithoutRetrying() {
        AtomicInteger calls = new AtomicInteger();

        RetryExecutor.RetryOutcome<String> outcome = retryExecutor.executeWithRetry(CONFIG, "test-op", () -> {
            calls.incrementAndGet();
            return "ok";
        });

        assertThat(outcome.result()).isEqualTo("ok");
        assertThat(outcome.attemptsUsed()).isEqualTo(1);
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void retriesTransientFailuresThenSucceeds() {
        AtomicInteger calls = new AtomicInteger();

        RetryExecutor.RetryOutcome<String> outcome = retryExecutor.executeWithRetry(CONFIG, "test-op", () -> {
            if (calls.incrementAndGet() < 3) {
                throw new RuntimeException("transient failure #" + calls.get());
            }
            return "ok-on-third-try";
        });

        assertThat(outcome.result()).isEqualTo("ok-on-third-try");
        assertThat(outcome.attemptsUsed()).isEqualTo(3);
        assertThat(calls.get()).isEqualTo(3);
    }

    @Test
    void throwsRetryExhaustedAfterAllAttemptsFail() {
        AtomicInteger calls = new AtomicInteger();

        assertThatThrownBy(() -> retryExecutor.executeWithRetry(CONFIG, "test-op", () -> {
            calls.incrementAndGet();
            throw new RuntimeException("permanent failure");
        }))
                .isInstanceOf(RetryExhaustedException.class)
                .hasCauseInstanceOf(RuntimeException.class)
                .satisfies(e -> assertThat(((RetryExhaustedException) e).getAttemptsMade()).isEqualTo(3));

        assertThat(calls.get()).isEqualTo(CONFIG.maxAttempts());
    }
}
