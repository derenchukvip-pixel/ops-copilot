package dev.artsiom.opscopilot.dto;

/**
 * Snapshot for the demo/admin view (section 9 of the spec). Computed on demand from the tickets
 * table rather than a materialized rollup — fine at this scale, would need a scheduled
 * aggregation job well before {@code ticketRepository.findAll()} became the bottleneck.
 */
public record MetricsSummaryResponse(
        long totalTickets,
        long resolvedAutoCount,
        long pendingApprovalCount,
        long escalatedCount,
        long errorCount,
        double autonomousResolutionRate,
        Double averageResolutionSeconds
) {
}
