package dev.artsiom.opscopilot.controller;

import dev.artsiom.opscopilot.domain.PendingActionStatus;
import dev.artsiom.opscopilot.dto.ApproveActionRequest;
import dev.artsiom.opscopilot.dto.PendingActionResponse;
import dev.artsiom.opscopilot.dto.RejectActionRequest;
import dev.artsiom.opscopilot.service.PendingActionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pending-actions")
@Tag(name = "Pending Actions", description = "Human-in-the-loop approval queue (FR5)")
public class PendingActionController {

    private final PendingActionService pendingActionService;

    public PendingActionController(PendingActionService pendingActionService) {
        this.pendingActionService = pendingActionService;
    }

    @GetMapping
    @Operation(summary = "List actions awaiting operator review, with full ticket + decision context")
    public List<PendingActionResponse> list(
            @RequestParam(defaultValue = "PENDING") PendingActionStatus status) {
        return pendingActionService.listByStatus(status);
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve a queued action — executes the tool immediately")
    public void approve(@PathVariable Long id, @RequestBody(required = false) ApproveActionRequest request) {
        String reviewedBy = request != null ? request.reviewedBy() : null;
        pendingActionService.approve(id, reviewedBy);
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject a queued action — the ticket is escalated to a human")
    public void reject(@PathVariable Long id, @Valid @RequestBody RejectActionRequest request) {
        pendingActionService.reject(id, request.reviewedBy(), request.reason());
    }
}
