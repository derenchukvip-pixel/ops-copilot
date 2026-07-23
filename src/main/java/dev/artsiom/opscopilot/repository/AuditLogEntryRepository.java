package dev.artsiom.opscopilot.repository;

import dev.artsiom.opscopilot.domain.AuditLogEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Only {@code save} and the finder below are ever called against this repository.
 * There is no application code path that updates or deletes an audit entry — and even if there
 * were, the database triggers on audit_log_entries (V1__init_schema.sql) would reject it.
 */
public interface AuditLogEntryRepository extends JpaRepository<AuditLogEntry, Long> {

    List<AuditLogEntry> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
