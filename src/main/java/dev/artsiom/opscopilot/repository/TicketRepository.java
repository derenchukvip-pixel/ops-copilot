package dev.artsiom.opscopilot.repository;

import dev.artsiom.opscopilot.domain.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    Optional<Ticket> findByExternalId(String externalId);
}
