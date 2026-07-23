package dev.artsiom.opscopilot.repository;

import dev.artsiom.opscopilot.domain.ToolCall;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ToolCallRepository extends JpaRepository<ToolCall, Long> {

    List<ToolCall> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
