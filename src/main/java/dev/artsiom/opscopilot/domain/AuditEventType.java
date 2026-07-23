package dev.artsiom.opscopilot.domain;

public enum AuditEventType {
    TICKET_RECEIVED,
    CLASSIFIED,
    TOOL_CALLED,
    TOOL_RESULT,
    ACTION_AUTO_EXECUTED,
    ACTION_QUEUED_FOR_APPROVAL,
    ACTION_APPROVED,
    ACTION_REJECTED,
    ESCALATED_TO_HUMAN,
    ERROR
}
