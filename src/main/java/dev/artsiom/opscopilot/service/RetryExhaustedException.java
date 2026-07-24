package dev.artsiom.opscopilot.service;

/**
 * Thrown by {@link RetryExecutor} once every attempt has failed. Distinct from a plain
 * RuntimeException so callers can tell "this failed after genuinely retrying" apart from "this
 * failed once and wasn't retried at all" when deciding how to log/audit it.
 */
public class RetryExhaustedException extends RuntimeException {

    private final int attemptsMade;

    public RetryExhaustedException(String message, Throwable cause, int attemptsMade) {
        super(message, cause);
        this.attemptsMade = attemptsMade;
    }

    public int getAttemptsMade() {
        return attemptsMade;
    }
}
