package dev.artsiom.opscopilot.controller;

import dev.artsiom.opscopilot.domain.AuditLogEntry;
import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.dto.AuditLogEntryResponse;
import dev.artsiom.opscopilot.dto.TicketRequest;
import dev.artsiom.opscopilot.dto.TicketResponse;
import dev.artsiom.opscopilot.service.AuditLogService;
import dev.artsiom.opscopilot.service.TicketIngestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@Tag(name = "Tickets", description = "Ticket intake and status (FR1, FR6)")
public class TicketController {

    private final TicketIngestionService ticketIngestionService;
    private final AuditLogService auditLogService;

    public TicketController(TicketIngestionService ticketIngestionService, AuditLogService auditLogService) {
        this.ticketIngestionService = ticketIngestionService;
        this.auditLogService = auditLogService;
    }

    @PostMapping
    @Operation(summary = "Submit a support ticket. Idempotent on externalId — resubmitting the "
            + "same externalId returns the original ticket instead of creating a duplicate.")
    public ResponseEntity<TicketResponse> submitTicket(@Valid @RequestBody TicketRequest request) {
        TicketIngestionService.IngestResult result = ticketIngestionService.ingest(request);
        HttpStatus status = result.created() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(TicketResponse.from(result.ticket()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get the current status of a ticket")
    public TicketResponse getTicket(@PathVariable Long id) {
        Ticket ticket = ticketIngestionService.getById(id);
        return TicketResponse.from(ticket);
    }

    @GetMapping("/{id}/audit-log")
    @Operation(summary = "Full chronological audit trail for a ticket (FR6)")
    public List<AuditLogEntryResponse> getAuditLog(@PathVariable Long id) {
        ticketIngestionService.getById(id); // 404s if the ticket doesn't exist
        List<AuditLogEntry> entries = auditLogService.findByTicketId(id);
        return entries.stream()
                .map(entry -> new AuditLogEntryResponse(
                        entry.getId(),
                        entry.getEventType(),
                        auditLogService.parsePayload(entry),
                        entry.getCreatedAt()))
                .toList();
    }
}
