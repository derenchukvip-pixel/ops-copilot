package dev.artsiom.opscopilot.tools;

/**
 * Thrown by {@link Tool#validateParameters} when the parameters — regardless of whether they
 * came from the LLM or from ticket data — don't satisfy the tool's contract. Never bypassed:
 * every execution path validates before acting, per FR4's "never trust LLM output directly".
 */
public class ToolValidationException extends RuntimeException {

    public ToolValidationException(String message) {
        super(message);
    }
}
