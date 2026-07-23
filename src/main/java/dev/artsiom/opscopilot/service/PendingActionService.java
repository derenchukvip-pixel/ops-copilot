package dev.artsiom.opscopilot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.domain.AgentDecision;
import dev.artsiom.opscopilot.domain.AuditEventType;
import dev.artsiom.opscopilot.domain.PendingAction;
import dev.artsiom.opscopilot.domain.PendingActionStatus;
import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketStatus;
import dev.artsiom.opscopilot.domain.ToolCall;
import dev.artsiom.opscopilot.domain.ToolCallStatus;
import dev.artsiom.opscopilot.dto.PendingActionResponse;
import dev.artsiom.opscopilot.exception.PendingActionAlreadyReviewedException;
import dev.artsiom.opscopilot.exception.PendingActionNotFoundException;
import dev.artsiom.opscopilot.exception.TicketNotFoundException;
import dev.artsiom.opscopilot.repository.AgentDecisionRepository;
import dev.artsiom.opscopilot.repository.PendingActionRepository;
import dev.artsiom.opscopilot.repository.TicketRepository;
import dev.artsiom.opscopilot.repository.ToolCallRepository;
import dev.artsiom.opscopilot.tools.Tool;
import dev.artsiom.opscopilot.tools.ToolExecutionResult;
import dev.artsiom.opscopilot.tools.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Human-in-the-loop queue for REQUIRES_APPROVAL tools (FR5). The approve/reject write path goes
 * through {@link PendingActionRepository#transitionIfPending}, an atomic conditional UPDATE —
 * there is deliberately no read-modify-write here. Two concurrent approve calls on the same
 * action (a double-click, a retried request) will race on that UPDATE; exactly one affects a
 * row, and the loser gets {@link PendingActionAlreadyReviewedException} instead of executing the
 * tool a second time. That is the FR7 idempotency guarantee for this endpoint.
 */
@Service
public class PendingActionService {

    private static final Logger log = LoggerFactory.getLogger(PendingActionService.class);
    private static final String DEFAULT_REVIEWER = "operator";

    private final PendingActionRepository pendingActionRepository;
    private final TicketRepository ticketRepository;
    private final AgentDecisionRepository agentDecisionRepository;
    private final ToolCallRepository toolCallRepository;
    private final ToolRegistry toolRegistry;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public PendingActionService(PendingActionRepository pendingActionRepository, TicketRepository ticketRepository,
                                 AgentDecisionRepository agentDecisionRepository, ToolCallRepository toolCallRepository,
                                 ToolRegistry toolRegistry, AuditLogService auditLogService, ObjectMapper objectMapper) {
        this.pendingActionRepository = pendingActionRepository;
        this.ticketRepository = ticketRepository;
        this.agentDecisionRepository = agentDecisionRepository;
        this.toolCallRepository = toolCallRepository;
        this.toolRegistry = toolRegistry;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    /**
     * Validates and queues a proposed action. Called by the orchestrator, never directly from a
     * controller — the ticket must already exist and the tool must already be REQUIRES_APPROVAL.
     */
    @Transactional
    public PendingAction createPendingAction(Long ticketId, String toolName, JsonNode parameters) {
        Tool tool = toolRegistry.get(toolName);
        tool.validateParameters(parameters);

        PendingAction pendingAction = pendingActionRepository.save(
                new PendingAction(ticketId, toolName, writeJson(parameters)));

        auditLogService.record(ticketId, AuditEventType.ACTION_QUEUED_FOR_APPROVAL, Map.of(
                "pendingActionId", pendingAction.getId(),
                "toolName", toolName,
                "parameters", parameters));

        return pendingAction;
    }

    @Transactional(readOnly = true)
    public List<PendingActionResponse> listByStatus(PendingActionStatus status) {
        return pendingActionRepository.findByStatus(status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PendingAction approve(Long pendingActionId, String reviewedBy) {
        String reviewer = reviewedBy == null || reviewedBy.isBlank() ? DEFAULT_REVIEWER : reviewedBy;
        Instant now = Instant.now();

        int updated = pendingActionRepository.transitionIfPending(
                pendingActionId, PendingActionStatus.APPROVED, reviewer, now, null);
        if (updated == 0) {
            throw alreadyReviewedOrNotFound(pendingActionId);
        }

        PendingAction pendingAction = getOrThrow(pendingActionId);
        Tool tool = toolRegistry.get(pendingAction.getToolName());
        JsonNode parameters = readJson(pendingAction.getParameters());
        tool.validateParameters(parameters);

        ToolCall toolCall = new ToolCall(pendingAction.getTicketId(), tool.name(), pendingAction.getParameters());
        try {
            ToolExecutionResult result = tool.execute(parameters);
            toolCall.recordAttempt(ToolCallStatus.SUCCESS, writeJson(result.data()));
            toolCallRepository.save(toolCall);

            auditLogService.record(pendingAction.getTicketId(), AuditEventType.ACTION_APPROVED, Map.of(
                    "pendingActionId", pendingActionId, "reviewedBy", reviewer, "result", result.summary()));

            Ticket ticket = getTicketOrThrow(pendingAction.getTicketId());
            ticket.setStatus(TicketStatus.RESOLVED_AUTO);
            ticket.setResolvedAt(now);
            ticketRepository.save(ticket);
        } catch (RuntimeException e) {
            toolCall.recordAttempt(ToolCallStatus.FAILED, e.getMessage());
            toolCallRepository.save(toolCall);
            auditLogService.record(pendingAction.getTicketId(), AuditEventType.ERROR, Map.of(
                    "pendingActionId", pendingActionId, "toolName", tool.name(), "error", String.valueOf(e.getMessage())));
            log.error("Approved action {} failed to execute", pendingActionId, e);
            throw e;
        }

        return pendingAction;
    }

    @Transactional
    public PendingAction reject(Long pendingActionId, String reviewedBy, String reason) {
        String reviewer = reviewedBy == null || reviewedBy.isBlank() ? DEFAULT_REVIEWER : reviewedBy;
        Instant now = Instant.now();

        int updated = pendingActionRepository.transitionIfPending(
                pendingActionId, PendingActionStatus.REJECTED, reviewer, now, reason);
        if (updated == 0) {
            throw alreadyReviewedOrNotFound(pendingActionId);
        }

        PendingAction pendingAction = getOrThrow(pendingActionId);

        auditLogService.record(pendingAction.getTicketId(), AuditEventType.ACTION_REJECTED, Map.of(
                "pendingActionId", pendingActionId, "reviewedBy", reviewer, "reason", reason));

        Ticket ticket = getTicketOrThrow(pendingAction.getTicketId());
        ticket.setStatus(TicketStatus.ESCALATED);
        ticketRepository.save(ticket);

        auditLogService.record(pendingAction.getTicketId(), AuditEventType.ESCALATED_TO_HUMAN, Map.of(
                "reason", "PendingAction " + pendingActionId + " rejected: " + reason));

        return pendingAction;
    }

    private RuntimeException alreadyReviewedOrNotFound(Long pendingActionId) {
        if (pendingActionRepository.findById(pendingActionId).isEmpty()) {
            return new PendingActionNotFoundException(pendingActionId);
        }
        return new PendingActionAlreadyReviewedException(pendingActionId);
    }

    private PendingAction getOrThrow(Long pendingActionId) {
        return pendingActionRepository.findById(pendingActionId)
                .orElseThrow(() -> new PendingActionNotFoundException(pendingActionId));
    }

    private Ticket getTicketOrThrow(Long ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new TicketNotFoundException(ticketId));
    }

    private PendingActionResponse toResponse(PendingAction action) {
        Ticket ticket = getTicketOrThrow(action.getTicketId());
        AgentDecision latestDecision = agentDecisionRepository
                .findFirstByTicketIdOrderByCreatedAtDesc(action.getTicketId())
                .orElse(null);

        return new PendingActionResponse(
                action.getId(),
                action.getTicketId(),
                ticket.getCustomerEmail(),
                ticket.getSubject(),
                action.getToolName(),
                readJson(action.getParameters()),
                action.getStatus(),
                latestDecision != null ? latestDecision.getCategory() : null,
                latestDecision != null ? latestDecision.getConfidence() : null,
                latestDecision != null ? latestDecision.getReasoning() : null,
                action.getReviewedBy(),
                action.getReviewedAt(),
                action.getReason(),
                action.getCreatedAt());
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize value to JSON", e);
        }
    }

    private JsonNode readJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to parse stored JSON", e);
        }
    }
}
