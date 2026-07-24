package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketStatus;
import dev.artsiom.opscopilot.dto.MetricsSummaryResponse;
import dev.artsiom.opscopilot.repository.TicketRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MetricsServiceTest {

    private Ticket ticketWith(TicketStatus status, Instant receivedAt, Instant resolvedAt) {
        Ticket ticket = new Ticket("ext", "a@b.com", "s", "b", receivedAt);
        ticket.setStatus(status);
        if (resolvedAt != null) {
            ticket.setResolvedAt(resolvedAt);
        }
        return ticket;
    }

    @Test
    void computesAutonomousResolutionRateAndAverageResolutionTime() {
        Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
        List<Ticket> tickets = List.of(
                ticketWith(TicketStatus.RESOLVED_AUTO, t0, t0.plusSeconds(10)),
                ticketWith(TicketStatus.RESOLVED_AUTO, t0, t0.plusSeconds(30)),
                ticketWith(TicketStatus.PENDING_APPROVAL, t0, null),
                ticketWith(TicketStatus.ESCALATED, t0, null)
        );

        TicketRepository ticketRepository = mock(TicketRepository.class);
        when(ticketRepository.findAll()).thenReturn(tickets);

        MetricsSummaryResponse summary = new MetricsService(ticketRepository).getSummary();

        assertThat(summary.totalTickets()).isEqualTo(4);
        assertThat(summary.resolvedAutoCount()).isEqualTo(2);
        assertThat(summary.pendingApprovalCount()).isEqualTo(1);
        assertThat(summary.escalatedCount()).isEqualTo(1);
        assertThat(summary.errorCount()).isEqualTo(0);
        assertThat(summary.autonomousResolutionRate()).isEqualTo(0.5);
        assertThat(summary.averageResolutionSeconds()).isEqualTo(20.0);
    }

    @Test
    void returnsZeroRateAndNullAverageWhenNoTicketsExist() {
        TicketRepository ticketRepository = mock(TicketRepository.class);
        when(ticketRepository.findAll()).thenReturn(List.of());

        MetricsSummaryResponse summary = new MetricsService(ticketRepository).getSummary();

        assertThat(summary.totalTickets()).isEqualTo(0);
        assertThat(summary.autonomousResolutionRate()).isEqualTo(0.0);
        assertThat(summary.averageResolutionSeconds()).isNull();
    }
}
