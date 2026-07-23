package dev.artsiom.opscopilot.repository;

import dev.artsiom.opscopilot.domain.AgentDecision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AgentDecisionRepository extends JpaRepository<AgentDecision, Long> {

    List<AgentDecision> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
