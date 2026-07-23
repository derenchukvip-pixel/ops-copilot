package dev.artsiom.opscopilot.exception;

public class PendingActionNotFoundException extends RuntimeException {

    public PendingActionNotFoundException(Long pendingActionId) {
        super("Pending action not found: " + pendingActionId);
    }
}
