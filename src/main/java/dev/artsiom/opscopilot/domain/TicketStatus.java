package dev.artsiom.opscopilot.domain;

public enum TicketStatus {
    RECEIVED,
    PROCESSING,
    RESOLVED_AUTO,
    PENDING_APPROVAL,
    ESCALATED,
    ERROR
}
