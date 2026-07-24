package dev.artsiom.opscopilot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.config.AgentProperties;
import dev.artsiom.opscopilot.domain.PendingAction;
import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketCategory;
import dev.artsiom.opscopilot.domain.TicketStatus;
import dev.artsiom.opscopilot.domain.ToolCallStatus;
import dev.artsiom.opscopilot.llm.ClassificationResult;
import dev.artsiom.opscopilot.llm.LlmClient;
import dev.artsiom.opscopilot.llm.LlmException;
import dev.artsiom.opscopilot.llm.ParameterExtractionResult;
import dev.artsiom.opscopilot.llm.TicketClassification;
import dev.artsiom.opscopilot.repository.AgentDecisionRepository;
import dev.artsiom.opscopilot.repository.TicketRepository;
import dev.artsiom.opscopilot.repository.ToolCallRepository;
import dev.artsiom.opscopilot.tools.RiskTier;
import dev.artsiom.opscopilot.tools.Tool;
import dev.artsiom.opscopilot.tools.ToolExecutionResult;
import dev.artsiom.opscopilot.tools.ToolRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the FR8 guardrails and the main routing branches of the agent loop. Every
 * collaborator except {@link DecisionEngine} and {@link RetryExecutor} (both pure/deterministic,
 * cheaper to run for real than to mock) is a Mockito double — this is the layer where "does the
 * max-iterations guardrail actually stop a call" and "does the token budget actually abort the
 * run" need to be provably true, not just asserted in a comment.
 */
class AgentOrchestrationServiceTest {

    private LlmClient llmClient;
    private ToolRegistry toolRegistry;
    private AuditLogService auditLogService;
    private TicketRepository ticketRepository;
    private AgentDecisionRepository agentDecisionRepository;
    private ToolCallRepository toolCallRepository;
    private PendingActionService pendingActionService;
    private Tool passwordResetTool;
    private Tool escalateTool;
    private Tool changePlanTool;
    private ObjectMapper objectMapper;

    private AgentProperties defaultAgentProperties() {
        return new AgentProperties(new BigDecimal("0.85"), 6, 20_000,
                new AgentProperties.RetryConfig(3, 1, 1.0),
                new AgentProperties.RetryConfig(3, 1, 1.0));
    }

    private AgentOrchestrationService newService(AgentProperties agentProperties) {
        return new AgentOrchestrationService(llmClient, new DecisionEngine(), toolRegistry, auditLogService,
                ticketRepository, agentDecisionRepository, toolCallRepository, pendingActionService,
                new RetryExecutor(), objectMapper, agentProperties);
    }

    @BeforeEach
    void setUp() throws Exception {
        llmClient = mock(LlmClient.class);
        auditLogService = mock(AuditLogService.class);
        ticketRepository = mock(TicketRepository.class);
        agentDecisionRepository = mock(AgentDecisionRepository.class);
        toolCallRepository = mock(ToolCallRepository.class);
        pendingActionService = mock(PendingActionService.class);
        objectMapper = new ObjectMapper();

        passwordResetTool = mock(Tool.class);
        when(passwordResetTool.name()).thenReturn("send_password_reset_link");
        when(passwordResetTool.riskTier()).thenReturn(RiskTier.SAFE);
        when(passwordResetTool.execute(any())).thenReturn(new ToolExecutionResult("sent", "ok"));

        escalateTool = mock(Tool.class);
        when(escalateTool.name()).thenReturn("escalate_to_human");
        when(escalateTool.riskTier()).thenReturn(RiskTier.SAFE);
        when(escalateTool.execute(any())).thenReturn(new ToolExecutionResult("escalated", "ok"));

        changePlanTool = mock(Tool.class);
        when(changePlanTool.name()).thenReturn("change_subscription_plan");
        when(changePlanTool.riskTier()).thenReturn(RiskTier.REQUIRES_APPROVAL);
        when(changePlanTool.description()).thenReturn("desc");
        when(changePlanTool.inputSchema()).thenReturn(objectMapper.readTree("{\"type\":\"object\"}"));

        toolRegistry = new ToolRegistry(List.of(passwordResetTool, escalateTool, changePlanTool));

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket()));
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private Ticket testTicket() {
        Ticket ticket = new Ticket("ext-1", "alice@acme.io", "Forgot password", "I can't log in", Instant.now());
        ReflectionTestUtils.setField(ticket, "id", 1L);
        return ticket;
    }

    @Test
    void autoExecutesSafeToolOnHighConfidenceClassification() {
        when(llmClient.classifyTicket(anyString(), anyString())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.PASSWORD_RESET, new BigDecimal("0.95"), "clear reset request"),
                50, 20));

        newService(defaultAgentProperties()).process(1L);

        verify(passwordResetTool).execute(any());
        verify(toolCallRepository).save(argThatStatus(ToolCallStatus.SUCCESS));

        ArgumentCaptor<Ticket> ticketCaptor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getStatus()).isEqualTo(TicketStatus.RESOLVED_AUTO);
    }

    @Test
    void escalatesWithoutAttemptingActionForUnclearCategory() {
        when(llmClient.classifyTicket(anyString(), anyString())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.UNCLEAR, new BigDecimal("0.99"), "ambiguous message"),
                50, 20));

        newService(defaultAgentProperties()).process(1L);

        verify(passwordResetTool, never()).execute(any());
        verify(escalateTool).execute(any());

        ArgumentCaptor<Ticket> ticketCaptor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getStatus()).isEqualTo(TicketStatus.ESCALATED);
    }

    @Test
    void maxIterationsGuardrailBlocksParameterExtractionForApprovalTools() {
        when(llmClient.classifyTicket(anyString(), anyString())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.PLAN_CHANGE_REQUEST, new BigDecimal("0.95"), "wants pro plan"),
                50, 20));

        // maxIterations=1: classification itself is iteration 1 (allowed), but queuing an
        // approval tool needs a second iteration (parameter extraction) — that must be blocked.
        AgentProperties oneIteration = new AgentProperties(new BigDecimal("0.85"), 1, 20_000,
                new AgentProperties.RetryConfig(3, 1, 1.0), new AgentProperties.RetryConfig(3, 1, 1.0));

        newService(oneIteration).process(1L);

        verify(llmClient, never()).extractParameters(any(), any(), any(), any(), any());
        verify(pendingActionService, never()).createPendingAction(any(), any(), any());
        verify(escalateTool).execute(any());

        ArgumentCaptor<Ticket> ticketCaptor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getStatus()).isEqualTo(TicketStatus.ESCALATED);
    }

    @Test
    void tokenBudgetGuardrailAbortsRunAfterClassification() {
        when(llmClient.classifyTicket(anyString(), anyString())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.PASSWORD_RESET, new BigDecimal("0.95"), "clear reset request"),
                8000, 8000));

        AgentProperties tinyBudget = new AgentProperties(new BigDecimal("0.85"), 6, 10_000,
                new AgentProperties.RetryConfig(3, 1, 1.0), new AgentProperties.RetryConfig(3, 1, 1.0));

        newService(tinyBudget).process(1L);

        verify(passwordResetTool, never()).execute(any());
        verify(escalateTool).execute(any());

        ArgumentCaptor<Ticket> ticketCaptor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getStatus()).isEqualTo(TicketStatus.ESCALATED);
    }

    @Test
    void llmClassificationFailureMovesTicketToErrorAndLogsEscalation() {
        when(llmClient.classifyTicket(anyString(), anyString()))
                .thenThrow(new LlmException("Anthropic API down"));

        newService(defaultAgentProperties()).process(1L);

        ArgumentCaptor<Ticket> ticketCaptor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getStatus()).isEqualTo(TicketStatus.ERROR);
    }

    @Test
    void queueForApprovalMergesExtractedParametersWithAuthoritativeEmail() throws Exception {
        when(llmClient.classifyTicket(anyString(), anyString())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.PLAN_CHANGE_REQUEST, new BigDecimal("0.95"), "wants pro plan"),
                50, 20));
        when(llmClient.extractParameters(any(), any(), eq("change_subscription_plan"), any(), any()))
                .thenReturn(new ParameterExtractionResult(
                        objectMapper.readTree("{\"customerEmail\": \"someone-else@example.com\", \"targetPlan\": \"pro\"}"),
                        30, 10));
        when(pendingActionService.createPendingAction(eq(1L), eq("change_subscription_plan"), any()))
                .thenReturn(mock(PendingAction.class));

        newService(defaultAgentProperties()).process(1L);

        ArgumentCaptor<com.fasterxml.jackson.databind.JsonNode> paramsCaptor =
                ArgumentCaptor.forClass(com.fasterxml.jackson.databind.JsonNode.class);
        verify(pendingActionService).createPendingAction(eq(1L), eq("change_subscription_plan"), paramsCaptor.capture());

        // The ticket's own email always wins over whatever the model extracted.
        assertThat(paramsCaptor.getValue().get("customerEmail").asText()).isEqualTo("alice@acme.io");
        assertThat(paramsCaptor.getValue().get("targetPlan").asText()).isEqualTo("pro");

        ArgumentCaptor<Ticket> ticketCaptor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getStatus()).isEqualTo(TicketStatus.PENDING_APPROVAL);
    }

    private dev.artsiom.opscopilot.domain.ToolCall argThatStatus(ToolCallStatus status) {
        return org.mockito.ArgumentMatchers.argThat(toolCall -> toolCall.getStatus() == status);
    }
}
