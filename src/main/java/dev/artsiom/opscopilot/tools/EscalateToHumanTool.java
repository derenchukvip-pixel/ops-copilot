package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Always-available fallback (FR4: "always available, does not require approval on the fact of
 * escalation itself"). Executing it never has a risky side effect — it just records why a human
 * needs to look at the ticket; the orchestrator is what actually flips the ticket to ESCALATED
 * and writes the ESCALATED_TO_HUMAN audit event.
 */
@Component
public class EscalateToHumanTool implements Tool {

    private static final Logger log = LoggerFactory.getLogger(EscalateToHumanTool.class);

    private static final String SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "reason": {
                  "type": "string",
                  "description": "Why this ticket needs a human — low confidence, unclear intent, spam, or no safe automated action exists."
                }
              },
              "required": ["reason"]
            }
            """;

    private final JsonNode schema;

    public EscalateToHumanTool(ObjectMapper objectMapper) {
        this.schema = ToolSchemas.parse(objectMapper, SCHEMA_JSON);
    }

    @Override
    public String name() {
        return "escalate_to_human";
    }

    @Override
    public RiskTier riskTier() {
        return RiskTier.SAFE;
    }

    @Override
    public String description() {
        return "Hands the ticket off to a human support agent. Always available regardless of "
                + "category or confidence.";
    }

    @Override
    public JsonNode inputSchema() {
        return schema;
    }

    @Override
    public void validateParameters(JsonNode parameters) {
        ToolSchemas.requireNonBlankText(parameters, "reason");
    }

    @Override
    public ToolExecutionResult execute(JsonNode parameters) {
        String reason = parameters.get("reason").asText();
        log.info("Escalating ticket to human: {}", reason);
        return new ToolExecutionResult("Escalated to human: " + reason, Map.of("reason", reason));
    }
}
