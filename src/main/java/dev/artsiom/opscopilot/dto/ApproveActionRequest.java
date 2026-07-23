package dev.artsiom.opscopilot.dto;

/** Optional body — {@code reviewedBy} defaults to "operator" when omitted (no auth in scope). */
public record ApproveActionRequest(String reviewedBy) {
}
