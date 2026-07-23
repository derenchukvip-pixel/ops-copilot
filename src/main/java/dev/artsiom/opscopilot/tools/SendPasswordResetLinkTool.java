package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.mock.MockBillingService;
import dev.artsiom.opscopilot.mock.PasswordResetLink;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class SendPasswordResetLinkTool implements Tool {

    private static final Logger log = LoggerFactory.getLogger(SendPasswordResetLinkTool.class);

    private static final String SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "customerEmail": {
                  "type": "string",
                  "description": "Email address of the customer to send the password reset link to."
                }
              },
              "required": ["customerEmail"]
            }
            """;

    private final MockBillingService billingService;
    private final JsonNode schema;

    public SendPasswordResetLinkTool(MockBillingService billingService, ObjectMapper objectMapper) {
        this.billingService = billingService;
        this.schema = ToolSchemas.parse(objectMapper, SCHEMA_JSON);
    }

    @Override
    public String name() {
        return "send_password_reset_link";
    }

    @Override
    public RiskTier riskTier() {
        return RiskTier.SAFE;
    }

    @Override
    public String description() {
        return "Generates a one-time password reset link and sends it to the customer's email. "
                + "Use when the customer is locked out of their account or explicitly asks to reset "
                + "their password.";
    }

    @Override
    public JsonNode inputSchema() {
        return schema;
    }

    @Override
    public void validateParameters(JsonNode parameters) {
        ToolSchemas.requireNonBlankEmail(parameters, "customerEmail");
    }

    @Override
    public ToolExecutionResult execute(JsonNode parameters) {
        String email = parameters.get("customerEmail").asText();
        PasswordResetLink link = billingService.generateResetLink(email);
        log.info("Sending password reset link to {} (expires {})", email, link.expiresAt());
        return new ToolExecutionResult("Password reset link sent to " + email, link);
    }
}
