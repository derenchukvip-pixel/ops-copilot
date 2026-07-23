package dev.artsiom.opscopilot.exception;

/**
 * Thrown when something (a decision map, a persisted PendingAction, an operator request) names a
 * tool that isn't registered. This is the FR8 allowlist enforcement point — a tool name that
 * doesn't resolve to a registered {@link dev.artsiom.opscopilot.tools.Tool} bean can never be
 * executed, no matter where the name came from.
 */
public class UnknownToolException extends RuntimeException {

    public UnknownToolException(String toolName) {
        super("Unknown tool: " + toolName);
    }
}
