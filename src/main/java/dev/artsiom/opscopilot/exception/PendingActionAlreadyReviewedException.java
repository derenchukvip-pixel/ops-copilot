package dev.artsiom.opscopilot.exception;

public class PendingActionAlreadyReviewedException extends RuntimeException {

    public PendingActionAlreadyReviewedException(Long pendingActionId) {
        super("Pending action " + pendingActionId + " was already reviewed and cannot be reviewed again");
    }
}
