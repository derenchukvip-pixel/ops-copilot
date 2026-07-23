package dev.artsiom.opscopilot.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Inbound payload for POST /api/tickets (FR1). {@code externalId} is the idempotency key —
 * the ID the upstream system (email/webhook gateway) assigns to this ticket.
 */
public record TicketRequest(
        @NotBlank String externalId,
        @NotBlank @Email String customerEmail,
        @NotBlank String subject,
        @NotBlank String body,
        @NotNull Instant receivedAt
) {
}
