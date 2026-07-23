package dev.artsiom.opscopilot.dto;

import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketStatus;

import java.time.Instant;

public record TicketResponse(
        Long id,
        String externalId,
        String customerEmail,
        String subject,
        String body,
        TicketStatus status,
        Instant receivedAt,
        Instant resolvedAt,
        Instant createdAt
) {

    public static TicketResponse from(Ticket ticket) {
        return new TicketResponse(
                ticket.getId(),
                ticket.getExternalId(),
                ticket.getCustomerEmail(),
                ticket.getSubject(),
                ticket.getBody(),
                ticket.getStatus(),
                ticket.getReceivedAt(),
                ticket.getResolvedAt(),
                ticket.getCreatedAt()
        );
    }
}
