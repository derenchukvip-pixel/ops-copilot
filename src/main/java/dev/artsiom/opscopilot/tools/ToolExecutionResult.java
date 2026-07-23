package dev.artsiom.opscopilot.tools;

/**
 * Outcome of a tool execution. {@code summary} is a human-readable line for the audit log and
 * operator UI; {@code data} is the structured payload (serialized to JSON) stored on the
 * ToolCall row.
 */
public record ToolExecutionResult(String summary, Object data) {
}
