package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.mock.Invoice;
import dev.artsiom.opscopilot.mock.MockBillingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class ResendInvoiceTool implements Tool {

    private static final Logger log = LoggerFactory.getLogger(ResendInvoiceTool.class);

    private static final String SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "customerEmail": {
                  "type": "string",
                  "description": "Email address of the customer whose latest invoice should be resent."
                }
              },
              "required": ["customerEmail"]
            }
            """;

    private final MockBillingService billingService;
    private final JsonNode schema;

    public ResendInvoiceTool(MockBillingService billingService, ObjectMapper objectMapper) {
        this.billingService = billingService;
        this.schema = ToolSchemas.parse(objectMapper, SCHEMA_JSON);
    }

    @Override
    public String name() {
        return "resend_invoice";
    }

    @Override
    public RiskTier riskTier() {
        return RiskTier.SAFE;
    }

    @Override
    public String description() {
        return "Fetches the customer's most recent invoice and sends it to their email. Use when "
                + "the customer asks for a copy of an invoice, receipt, or billing statement.";
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
        Invoice invoice = billingService.getLatestInvoice(email);
        log.info("Resending invoice {} to {}", invoice.id(), email);
        return new ToolExecutionResult("Invoice " + invoice.id() + " sent to " + email, invoice);
    }
}
