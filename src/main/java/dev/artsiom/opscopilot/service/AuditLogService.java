package dev.artsiom.opscopilot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.domain.AuditEventType;
import dev.artsiom.opscopilot.domain.AuditLogEntry;
import dev.artsiom.opscopilot.repository.AuditLogEntryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Writes append-only audit events (FR6). Every step of the agent loop calls this instead of
 * relying on logs alone — the goal is a queryable, tamper-evident history per ticket, not just
 * console output.
 */
@Service
public class AuditLogService {

    private final AuditLogEntryRepository repository;
    private final ObjectMapper objectMapper;

    public AuditLogService(AuditLogEntryRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public void record(Long ticketId, AuditEventType eventType, Object payload) {
        repository.save(new AuditLogEntry(ticketId, eventType, toJson(payload)));
    }

    public List<AuditLogEntry> findByTicketId(Long ticketId) {
        return repository.findByTicketIdOrderByCreatedAtAsc(ticketId);
    }

    public JsonNode parsePayload(AuditLogEntry entry) {
        if (entry.getPayload() == null) {
            return null;
        }
        try {
            return objectMapper.readTree(entry.getPayload());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt audit payload for entry " + entry.getId(), e);
        }
    }

    private String toJson(Object payload) {
        if (payload == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize audit payload", e);
        }
    }
}
