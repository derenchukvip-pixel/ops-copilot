package dev.artsiom.opscopilot.repository;

import dev.artsiom.opscopilot.domain.PendingAction;
import dev.artsiom.opscopilot.domain.PendingActionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface PendingActionRepository extends JpaRepository<PendingAction, Long> {

    List<PendingAction> findByStatus(PendingActionStatus status);

    List<PendingAction> findByTicketIdOrderByCreatedAtAsc(Long ticketId);

    /**
     * Atomically transitions a PendingAction out of PENDING. This is the sole write path for
     * approve/reject — it never reads-then-writes the entity, so two concurrent approve calls
     * (or a retried webhook) can race on this UPDATE and only one will affect a row. The caller
     * must check the returned count: 0 means the action was already reviewed and must not be
     * executed again (FR7 idempotency).
     */
    @Modifying
    @Query("""
            UPDATE PendingAction p
               SET p.status = :newStatus, p.reviewedBy = :reviewedBy,
                   p.reviewedAt = :reviewedAt, p.reason = :reason, p.updatedAt = :reviewedAt
             WHERE p.id = :id AND p.status = dev.artsiom.opscopilot.domain.PendingActionStatus.PENDING
            """)
    int transitionIfPending(@Param("id") Long id,
                             @Param("newStatus") PendingActionStatus newStatus,
                             @Param("reviewedBy") String reviewedBy,
                             @Param("reviewedAt") Instant reviewedAt,
                             @Param("reason") String reason);
}
