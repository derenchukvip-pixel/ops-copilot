package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.mock.MockBillingService;
import dev.artsiom.opscopilot.mock.RefundResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class IssueRefundTool implements Tool {

    private static final Logger log = LoggerFactory.getLogger(IssueRefundTool.class);
    private static final BigDecimal MAX_REFUND_AMOUNT = new BigDecimal("5000");

    private static final String SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "customerEmail": {
                  "type": "string",
                  "description": "Email address of the customer to refund."
                },
                "amount": {
                  "type": "number",
                  "minimum": 0,
                  "description": "Refund amount in USD."
                },
                "reason": {
                  "type": "string",
                  "description": "Why the refund is being issued, for the audit trail."
                }
              },
              "required": ["customerEmail", "amount", "reason"]
            }
            """;

    private final MockBillingService billingService;
    private final JsonNode schema;

    public IssueRefundTool(MockBillingService billingService, ObjectMapper objectMapper) {
        this.billingService = billingService;
        this.schema = ToolSchemas.parse(objectMapper, SCHEMA_JSON);
    }

    @Override
    public String name() {
        return "issue_refund";
    }

    @Override
    public RiskTier riskTier() {
        return RiskTier.REQUIRES_APPROVAL;
    }

    @Override
    public String description() {
        return "Issues a monetary refund to the customer. Use when the customer explicitly asks "
                + "for money back.";
    }

    @Override
    public JsonNode inputSchema() {
        return schema;
    }

    @Override
    public void validateParameters(JsonNode parameters) {
        ToolSchemas.requireNonBlankEmail(parameters, "customerEmail");
        ToolSchemas.requireNonBlankText(parameters, "reason");

        JsonNode amountNode = parameters.get("amount");
        if (amountNode == null || !amountNode.isNumber()) {
            throw new ToolValidationException("Missing or non-numeric required field: amount");
        }
        BigDecimal amount = amountNode.decimalValue();
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ToolValidationException("Refund amount must be positive, got: " + amount);
        }
        if (amount.compareTo(MAX_REFUND_AMOUNT) > 0) {
            throw new ToolValidationException(
                    "Refund amount " + amount + " exceeds the maximum of " + MAX_REFUND_AMOUNT
                            + " an agent may propose without further review");
        }
    }

    @Override
    public ToolExecutionResult execute(JsonNode parameters) {
        String email = parameters.get("customerEmail").asText();
        BigDecimal amount = parameters.get("amount").decimalValue();
        String reason = parameters.get("reason").asText();

        RefundResult result = billingService.issueRefund(email, amount, reason);
        log.info("Issued refund {} of {} to {}", result.refundId(), amount, email);
        return new ToolExecutionResult("Refunded " + amount + " to " + email, result);
    }
}
