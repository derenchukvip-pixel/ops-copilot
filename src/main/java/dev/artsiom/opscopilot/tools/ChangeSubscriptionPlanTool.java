package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.mock.CustomerAccount;
import dev.artsiom.opscopilot.mock.MockBillingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class ChangeSubscriptionPlanTool implements Tool {

    private static final Logger log = LoggerFactory.getLogger(ChangeSubscriptionPlanTool.class);
    private static final Set<String> VALID_PLANS = Set.of("starter", "pro", "business", "enterprise");

    private static final String SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "customerEmail": {
                  "type": "string",
                  "description": "Email address of the customer whose plan should change."
                },
                "targetPlan": {
                  "type": "string",
                  "enum": ["starter", "pro", "business", "enterprise"],
                  "description": "The plan to move the customer to."
                }
              },
              "required": ["customerEmail", "targetPlan"]
            }
            """;

    private final MockBillingService billingService;
    private final JsonNode schema;

    public ChangeSubscriptionPlanTool(MockBillingService billingService, ObjectMapper objectMapper) {
        this.billingService = billingService;
        this.schema = ToolSchemas.parse(objectMapper, SCHEMA_JSON);
    }

    @Override
    public String name() {
        return "change_subscription_plan";
    }

    @Override
    public RiskTier riskTier() {
        return RiskTier.REQUIRES_APPROVAL;
    }

    @Override
    public String description() {
        return "Changes the customer's subscription plan. Use when the customer explicitly asks "
                + "to upgrade, downgrade, or otherwise change their plan.";
    }

    @Override
    public JsonNode inputSchema() {
        return schema;
    }

    @Override
    public void validateParameters(JsonNode parameters) {
        ToolSchemas.requireNonBlankEmail(parameters, "customerEmail");
        String targetPlan = ToolSchemas.requireNonBlankText(parameters, "targetPlan");
        if (!VALID_PLANS.contains(targetPlan)) {
            throw new ToolValidationException("targetPlan must be one of " + VALID_PLANS + ", got: " + targetPlan);
        }
    }

    @Override
    public ToolExecutionResult execute(JsonNode parameters) {
        String email = parameters.get("customerEmail").asText();
        String targetPlan = parameters.get("targetPlan").asText();
        CustomerAccount account = billingService.changePlan(email, targetPlan);
        log.info("Changed subscription plan for {} to {}", email, account.getPlan());
        return new ToolExecutionResult("Changed " + email + "'s plan to " + targetPlan, account);
    }
}
