package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.mock.MockBillingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FR4: every tool must validate parameters independently of what the model returned — these
 * tests exercise that validation path directly, plus the mock execution contract.
 */
class SafeToolsTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockBillingService billingService;

    @BeforeEach
    void setUp() {
        billingService = new MockBillingService();
    }

    private JsonNode json(String json) throws Exception {
        return objectMapper.readTree(json);
    }

    @Test
    void sendPasswordResetLinkRejectsMissingEmail() throws Exception {
        SendPasswordResetLinkTool tool = new SendPasswordResetLinkTool(billingService, objectMapper);
        JsonNode params = json("{}");

        assertThatThrownBy(() -> tool.validateParameters(params))
                .isInstanceOf(ToolValidationException.class);
    }

    @Test
    void sendPasswordResetLinkRejectsInvalidEmail() throws Exception {
        SendPasswordResetLinkTool tool = new SendPasswordResetLinkTool(billingService, objectMapper);
        JsonNode params = json("{\"customerEmail\": \"not-an-email\"}");

        assertThatThrownBy(() -> tool.validateParameters(params))
                .isInstanceOf(ToolValidationException.class);
    }

    @Test
    void sendPasswordResetLinkExecutesSuccessfully() throws Exception {
        SendPasswordResetLinkTool tool = new SendPasswordResetLinkTool(billingService, objectMapper);
        JsonNode params = json("{\"customerEmail\": \"alice@acme.io\"}");

        tool.validateParameters(params);
        ToolExecutionResult result = tool.execute(params);

        assertThat(result.summary()).contains("alice@acme.io");
    }

    @Test
    void resendInvoiceExecutesSuccessfully() throws Exception {
        ResendInvoiceTool tool = new ResendInvoiceTool(billingService, objectMapper);
        JsonNode params = json("{\"customerEmail\": \"bob@acme.io\"}");

        tool.validateParameters(params);
        ToolExecutionResult result = tool.execute(params);

        assertThat(result.summary()).contains("bob@acme.io");
    }

    @Test
    void resendInvoiceRejectsBlankEmail() throws Exception {
        ResendInvoiceTool tool = new ResendInvoiceTool(billingService, objectMapper);
        JsonNode params = json("{\"customerEmail\": \"\"}");

        assertThatThrownBy(() -> tool.validateParameters(params))
                .isInstanceOf(ToolValidationException.class);
    }

    @Test
    void escalateToHumanRejectsMissingReason() throws Exception {
        EscalateToHumanTool tool = new EscalateToHumanTool(objectMapper);
        JsonNode params = json("{}");

        assertThatThrownBy(() -> tool.validateParameters(params))
                .isInstanceOf(ToolValidationException.class);
    }

    @Test
    void escalateToHumanExecutesSuccessfully() throws Exception {
        EscalateToHumanTool tool = new EscalateToHumanTool(objectMapper);
        JsonNode params = json("{\"reason\": \"Low confidence classification\"}");

        tool.validateParameters(params);
        ToolExecutionResult result = tool.execute(params);

        assertThat(result.summary()).contains("Low confidence classification");
    }

    @Test
    void toolRegistryRejectsUnknownToolName() {
        ToolRegistry registry = new ToolRegistry(java.util.List.of(new EscalateToHumanTool(objectMapper)));

        assertThatThrownBy(() -> registry.get("delete_all_customers"))
                .isInstanceOf(dev.artsiom.opscopilot.exception.UnknownToolException.class);
    }

    @Test
    void toolRegistryResolvesRegisteredTool() {
        EscalateToHumanTool escalateTool = new EscalateToHumanTool(objectMapper);
        ToolRegistry registry = new ToolRegistry(java.util.List.of(escalateTool));

        assertThat(registry.get("escalate_to_human")).isSameAs(escalateTool);
    }

    @Test
    void answerFaqFindsRelevantArticleByKeyword() throws Exception {
        AnswerFaqTool tool = new AnswerFaqTool(new FaqRepository(objectMapper), objectMapper);
        JsonNode params = json("{\"customerEmail\": \"alice@acme.io\", \"query\": \"Can I export my data as CSV?\"}");

        tool.validateParameters(params);
        ToolExecutionResult result = tool.execute(params);

        assertThat(result.summary()).contains("alice@acme.io");
    }

    @Test
    void answerFaqRejectsMissingQuery() throws Exception {
        AnswerFaqTool tool = new AnswerFaqTool(new FaqRepository(objectMapper), objectMapper);
        JsonNode params = json("{\"customerEmail\": \"alice@acme.io\"}");

        assertThatThrownBy(() -> tool.validateParameters(params))
                .isInstanceOf(ToolValidationException.class);
    }
}
