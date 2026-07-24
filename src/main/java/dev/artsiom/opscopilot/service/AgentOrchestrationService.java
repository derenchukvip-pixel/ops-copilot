package dev.artsiom.opscopilot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.artsiom.opscopilot.config.AgentProperties;
import dev.artsiom.opscopilot.domain.AgentDecision;
import dev.artsiom.opscopilot.domain.AuditEventType;
import dev.artsiom.opscopilot.domain.PendingAction;
import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketStatus;
import dev.artsiom.opscopilot.domain.ToolCall;
import dev.artsiom.opscopilot.domain.ToolCallStatus;
import dev.artsiom.opscopilot.exception.TicketNotFoundException;
import dev.artsiom.opscopilot.llm.ClassificationResult;
import dev.artsiom.opscopilot.llm.LlmClient;
import dev.artsiom.opscopilot.llm.LlmException;
import dev.artsiom.opscopilot.llm.ParameterExtractionResult;
import dev.artsiom.opscopilot.llm.TicketClassification;
import dev.artsiom.opscopilot.repository.AgentDecisionRepository;
import dev.artsiom.opscopilot.repository.TicketRepository;
import dev.artsiom.opscopilot.repository.ToolCallRepository;
import dev.artsiom.opscopilot.tools.Tool;
import dev.artsiom.opscopilot.tools.ToolExecutionResult;
import dev.artsiom.opscopilot.tools.ToolRegistry;
import dev.artsiom.opscopilot.tools.ToolValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/**
 * The ReAct-style agent loop (section 7 of the spec): classify, decide, act, observe — bounded
 * by the FR8 guardrails at every step. Deliberately NOT wrapped in a single {@code @Transactional}
 * block: this method calls out to the LLM over the network, and Spring Data JPA repository
 * methods (and the services built on them, like {@link AuditLogService}) are each transactional
 * on their own, so holding one long-lived connection across a slow HTTP call would be the wrong
 * trade — every persistence step here already gets its own short transaction.
 *
 * <p>Iteration budget in practice: SAFE tools (send_password_reset_link, resend_invoice,
 * answer_faq) need nothing beyond fields already on the Ticket, so they resolve in one
 * iteration (classify only). REQUIRES_APPROVAL tools (change_subscription_plan, issue_refund)
 * need a second iteration — a forced tool-use call that extracts the target plan or refund
 * amount from the ticket text — before they can be queued. The max-iterations guardrail (FR8)
 * is a hard ceiling above both of those, not a number this design is expected to approach in
 * normal operation.
 */
@Service
public class AgentOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(AgentOrchestrationService.class);
    private static final String ESCALATE_TOOL_NAME = "escalate_to_human";

    private final LlmClient llmClient;
    private final DecisionEngine decisionEngine;
    private final ToolRegistry toolRegistry;
    private final AuditLogService auditLogService;
    private final TicketRepository ticketRepository;
    private final AgentDecisionRepository agentDecisionRepository;
    private final ToolCallRepository toolCallRepository;
    private final PendingActionService pendingActionService;
    private final RetryExecutor retryExecutor;
    private final ObjectMapper objectMapper;
    private final AgentProperties agentProperties;

    public AgentOrchestrationService(LlmClient llmClient, DecisionEngine decisionEngine, ToolRegistry toolRegistry,
                                      AuditLogService auditLogService, TicketRepository ticketRepository,
                                      AgentDecisionRepository agentDecisionRepository, ToolCallRepository toolCallRepository,
                                      PendingActionService pendingActionService, RetryExecutor retryExecutor,
                                      ObjectMapper objectMapper, AgentProperties agentProperties) {
        this.llmClient = llmClient;
        this.decisionEngine = decisionEngine;
        this.toolRegistry = toolRegistry;
        this.auditLogService = auditLogService;
        this.ticketRepository = ticketRepository;
        this.agentDecisionRepository = agentDecisionRepository;
        this.toolCallRepository = toolCallRepository;
        this.pendingActionService = pendingActionService;
        this.retryExecutor = retryExecutor;
        this.objectMapper = objectMapper;
        this.agentProperties = agentProperties;
    }

    public void process(Long ticketId) {
        MDC.put("ticketId", String.valueOf(ticketId));
        try {
            runOrchestration(ticketId);
        } finally {
            MDC.remove("ticketId");
        }
    }

    private void runOrchestration(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new TicketNotFoundException(ticketId));
        setStatus(ticket, TicketStatus.PROCESSING, null);

        int iteration = 1;
        if (iteration > agentProperties.maxIterations()) {
            escalate(ticket, "Max agent iterations (" + agentProperties.maxIterations() + ") exceeded before classification");
            return;
        }

        ClassificationResult classificationResult;
        try {
            classificationResult = llmClient.classifyTicket(ticket.getSubject(), ticket.getBody());
        } catch (LlmException e) {
            handleLlmFailure(ticket, "classification", e);
            return;
        }

        TicketClassification classification = classificationResult.classification();
        agentDecisionRepository.save(new AgentDecision(
                ticketId, classification.category(), classification.confidence(), classification.reasoning()));
        auditLogService.record(ticketId, AuditEventType.CLASSIFIED, Map.of(
                "category", classification.category().getWireValue(),
                "confidence", classification.confidence(),
                "reasoning", classification.reasoning()));

        long tokensUsed = classificationResult.totalTokens();
        if (tokensUsed > agentProperties.maxTokenBudget()) {
            escalate(ticket, "Token budget (" + agentProperties.maxTokenBudget() + ") exceeded after classification: used " + tokensUsed);
            return;
        }

        DecisionOutcome outcome = decisionEngine.decide(
                classification.category(), classification.confidence(), agentProperties.confidenceThreshold());

        switch (outcome) {
            case DecisionOutcome.Escalate e -> escalate(ticket, e.reason());
            case DecisionOutcome.AutoExecute autoExecute -> handleAutoExecute(ticket, autoExecute.toolName());
            case DecisionOutcome.QueueForApproval queue ->
                    handleQueueForApproval(ticket, queue.toolName(), iteration, tokensUsed);
        }
    }

    private void handleAutoExecute(Ticket ticket, String toolName) {
        Tool tool = toolRegistry.get(toolName);
        JsonNode parameters = buildBaseParameters(ticket, tool);

        try {
            tool.validateParameters(parameters);
        } catch (ToolValidationException e) {
            auditLogService.record(ticket.getId(), AuditEventType.ERROR, Map.of(
                    "stage", "auto_execute_validation", "toolName", toolName, "error", e.getMessage()));
            escalate(ticket, "Parameter validation failed for " + toolName + ": " + e.getMessage());
            return;
        }

        auditLogService.record(ticket.getId(), AuditEventType.TOOL_CALLED, Map.of(
                "toolName", toolName, "parameters", parameters));

        ToolCall toolCall = new ToolCall(ticket.getId(), toolName, writeJson(parameters));
        try {
            RetryExecutor.RetryOutcome<ToolExecutionResult> outcome = retryExecutor.executeWithRetry(
                    agentProperties.toolRetry(), toolName, () -> tool.execute(parameters));

            toolCall.complete(outcome.attemptsUsed(), ToolCallStatus.SUCCESS, writeJson(outcome.result().data()));
            toolCallRepository.save(toolCall);

            auditLogService.record(ticket.getId(), AuditEventType.TOOL_RESULT, Map.of(
                    "toolName", toolName, "summary", outcome.result().summary()));
            auditLogService.record(ticket.getId(), AuditEventType.ACTION_AUTO_EXECUTED, Map.of("toolName", toolName));

            setStatus(ticket, TicketStatus.RESOLVED_AUTO, Instant.now());
        } catch (RetryExhaustedException e) {
            toolCall.complete(e.getAttemptsMade(), ToolCallStatus.FAILED, String.valueOf(e.getCause()));
            toolCallRepository.save(toolCall);
            failWithError(ticket, "Tool " + toolName + " failed after retries: " + e.getCause());
        }
    }

    private void handleQueueForApproval(Ticket ticket, String toolName, int iterationSoFar, long tokensSoFar) {
        Tool tool = toolRegistry.get(toolName);

        int iteration = iterationSoFar + 1;
        if (iteration > agentProperties.maxIterations()) {
            escalate(ticket, "Max agent iterations (" + agentProperties.maxIterations()
                    + ") exceeded before parameter extraction for " + toolName);
            return;
        }

        ObjectNode parameters;
        try {
            ParameterExtractionResult extraction = llmClient.extractParameters(
                    ticket.getSubject(), ticket.getBody(), tool.name(), tool.description(), tool.inputSchema());

            long totalTokens = tokensSoFar + extraction.totalTokens();
            if (totalTokens > agentProperties.maxTokenBudget()) {
                escalate(ticket, "Token budget (" + agentProperties.maxTokenBudget()
                        + ") exceeded during parameter extraction for " + toolName + ": used " + totalTokens);
                return;
            }

            JsonNode extracted = extraction.parameters();
            parameters = extracted.isObject() ? ((ObjectNode) extracted).deepCopy() : objectMapper.createObjectNode();
        } catch (LlmException e) {
            handleLlmFailure(ticket, "parameter_extraction", e);
            return;
        }

        // The model's extraction may guess at the email; the ticket's own field is authoritative
        // and always wins, regardless of what the LLM produced.
        parameters.put("customerEmail", ticket.getCustomerEmail());

        try {
            PendingAction pendingAction = pendingActionService.createPendingAction(ticket.getId(), toolName, parameters);
            log.info("Queued PendingAction {} ({}) for operator review", pendingAction.getId(), toolName);
            setStatus(ticket, TicketStatus.PENDING_APPROVAL, null);
        } catch (ToolValidationException e) {
            auditLogService.record(ticket.getId(), AuditEventType.ERROR, Map.of(
                    "stage", "queue_validation", "toolName", toolName, "error", e.getMessage()));
            escalate(ticket, "Parameter validation failed for " + toolName + ": " + e.getMessage());
        }
    }

    private JsonNode buildBaseParameters(Ticket ticket, Tool tool) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("customerEmail", ticket.getCustomerEmail());
        if ("answer_faq".equals(tool.name())) {
            node.put("query", ticket.getSubject() + "\n\n" + ticket.getBody());
        }
        return node;
    }

    private void escalate(Ticket ticket, String reason) {
        Tool escalateTool = toolRegistry.get(ESCALATE_TOOL_NAME);
        JsonNode parameters = objectMapper.createObjectNode().put("reason", reason);
        escalateTool.validateParameters(parameters);
        escalateTool.execute(parameters);

        auditLogService.record(ticket.getId(), AuditEventType.ESCALATED_TO_HUMAN, Map.of("reason", reason));
        setStatus(ticket, TicketStatus.ESCALATED, null);
    }

    private void handleLlmFailure(Ticket ticket, String stage, LlmException e) {
        auditLogService.record(ticket.getId(), AuditEventType.ERROR, Map.of(
                "stage", stage, "error", String.valueOf(e.getMessage())));
        failWithError(ticket, "LLM call failed during " + stage + ": " + e.getMessage());
    }

    private void failWithError(Ticket ticket, String reason) {
        setStatus(ticket, TicketStatus.ERROR, null);
        auditLogService.record(ticket.getId(), AuditEventType.ESCALATED_TO_HUMAN, Map.of("reason", reason));
        log.error("Ticket {} moved to ERROR: {}", ticket.getId(), reason);
    }

    private void setStatus(Ticket ticket, TicketStatus status, Instant resolvedAt) {
        ticket.setStatus(status);
        if (resolvedAt != null) {
            ticket.setResolvedAt(resolvedAt);
        }
        ticketRepository.save(ticket);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize value to JSON", e);
        }
    }
}
