package dev.artsiom.opscopilot.dto;

import com.fasterxml.jackson.databind.JsonNode;
import dev.artsiom.opscopilot.domain.PendingActionStatus;
import dev.artsiom.opscopilot.domain.TicketCategory;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Full context for an operator reviewing a queued action (FR5): what the agent proposed to do,
 * on which ticket, and why — never just a bare tool name and a button.
 */
public record PendingActionResponse(
        Long id,
        Long ticketId,
        String customerEmail,
        String subject,
        String toolName,
        JsonNode parameters,
        PendingActionStatus status,
        TicketCategory category,
        BigDecimal confidence,
        String reasoning,
        String reviewedBy,
        Instant reviewedAt,
        String reason,
        Instant createdAt
) {
}
