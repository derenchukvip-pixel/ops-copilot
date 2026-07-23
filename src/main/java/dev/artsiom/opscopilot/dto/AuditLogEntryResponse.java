package dev.artsiom.opscopilot.dto;

import com.fasterxml.jackson.databind.JsonNode;
import dev.artsiom.opscopilot.domain.AuditEventType;

import java.time.Instant;

public record AuditLogEntryResponse(
        Long id,
        AuditEventType eventType,
        JsonNode payload,
        Instant createdAt
) {
}
