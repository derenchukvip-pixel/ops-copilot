package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.domain.AuditEventType;
import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.dto.TicketRequest;
import dev.artsiom.opscopilot.exception.TicketNotFoundException;
import dev.artsiom.opscopilot.repository.TicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Idempotent ticket intake (FR1/FR7). {@code externalId} is the idempotency key: a webhook
 * retried with the same externalId must return the original ticket, never create a second row.
 * The unique constraint on tickets.external_id (V1__init_schema.sql) is the source of truth for
 * this guarantee — the findByExternalId check below is an optimization to avoid the exception
 * path on the common case, not the actual safety net. Two concurrent requests with the same
 * externalId can both pass that check; whichever loses the DB-level race gets
 * DataIntegrityViolationException and falls back to reading the winner's row.
 */
@Service
public class TicketIngestionService {

    private static final Logger log = LoggerFactory.getLogger(TicketIngestionService.class);

    private final TicketRepository ticketRepository;
    private final AuditLogService auditLogService;

    public TicketIngestionService(TicketRepository ticketRepository, AuditLogService auditLogService) {
        this.ticketRepository = ticketRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public IngestResult ingest(TicketRequest request) {
        return ticketRepository.findByExternalId(request.externalId())
                .map(existing -> {
                    log.info("Duplicate ticket submission for externalId={}, ticketId={} — returning existing ticket",
                            request.externalId(), existing.getId());
                    return new IngestResult(existing, false);
                })
                .orElseGet(() -> createNewTicket(request));
    }

    private IngestResult createNewTicket(TicketRequest request) {
        Ticket ticket = new Ticket(request.externalId(), request.customerEmail(),
                request.subject(), request.body(), request.receivedAt());
        try {
            ticket = ticketRepository.saveAndFlush(ticket);
        } catch (DataIntegrityViolationException e) {
            Ticket winner = ticketRepository.findByExternalId(request.externalId())
                    .orElseThrow(() -> e);
            log.info("Concurrent duplicate submission for externalId={} — deferring to ticketId={}",
                    request.externalId(), winner.getId());
            return new IngestResult(winner, false);
        }

        auditLogService.record(ticket.getId(), AuditEventType.TICKET_RECEIVED, Map.of(
                "externalId", ticket.getExternalId(),
                "customerEmail", ticket.getCustomerEmail(),
                "subject", ticket.getSubject()
        ));
        return new IngestResult(ticket, true);
    }

    @Transactional(readOnly = true)
    public Ticket getById(Long ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new TicketNotFoundException(ticketId));
    }

    public record IngestResult(Ticket ticket, boolean created) {
    }
}
