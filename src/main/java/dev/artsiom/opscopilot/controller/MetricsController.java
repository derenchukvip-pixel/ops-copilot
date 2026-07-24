package dev.artsiom.opscopilot.controller;

import dev.artsiom.opscopilot.dto.MetricsSummaryResponse;
import dev.artsiom.opscopilot.service.MetricsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/metrics")
@Tag(name = "Metrics", description = "Summary numbers for the demo/admin view (section 2 of the spec)")
public class MetricsController {

    private final MetricsService metricsService;

    public MetricsController(MetricsService metricsService) {
        this.metricsService = metricsService;
    }

    @GetMapping("/summary")
    @Operation(summary = "Autonomous resolution rate, ticket counts by status, average resolution time")
    public MetricsSummaryResponse summary() {
        return metricsService.getSummary();
    }
}
