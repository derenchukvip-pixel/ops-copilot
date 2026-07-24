package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketStatus;
import dev.artsiom.opscopilot.dto.MetricsSummaryResponse;
import dev.artsiom.opscopilot.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

/** Backs GET /api/metrics/summary — the numbers from section 2 of the spec, for the demo. */
@Service
public class MetricsService {

    private final TicketRepository ticketRepository;

    public MetricsService(TicketRepository ticketRepository) {
        this.ticketRepository = ticketRepository;
    }

    @Transactional(readOnly = true)
    public MetricsSummaryResponse getSummary() {
        List<Ticket> tickets = ticketRepository.findAll();
        long total = tickets.size();

        Map<TicketStatus, Long> countsByStatus = tickets.stream()
                .collect(Collectors.groupingBy(Ticket::getStatus, Collectors.counting()));

        long resolvedAuto = countsByStatus.getOrDefault(TicketStatus.RESOLVED_AUTO, 0L);
        long pendingApproval = countsByStatus.getOrDefault(TicketStatus.PENDING_APPROVAL, 0L);
        long escalated = countsByStatus.getOrDefault(TicketStatus.ESCALATED, 0L);
        long error = countsByStatus.getOrDefault(TicketStatus.ERROR, 0L);

        double autonomousResolutionRate = total == 0 ? 0.0 : (double) resolvedAuto / total;

        OptionalDouble averageResolutionSeconds = tickets.stream()
                .filter(t -> t.getResolvedAt() != null)
                .mapToLong(t -> Duration.between(t.getReceivedAt(), t.getResolvedAt()).getSeconds())
                .average();

        return new MetricsSummaryResponse(total, resolvedAuto, pendingApproval, escalated, error,
                autonomousResolutionRate,
                averageResolutionSeconds.isPresent() ? averageResolutionSeconds.getAsDouble() : null);
    }
}
