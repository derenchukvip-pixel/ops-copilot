package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class AnswerFaqTool implements Tool {

    private static final Logger log = LoggerFactory.getLogger(AnswerFaqTool.class);

    private static final String SCHEMA_JSON = """
            {
              "type": "object",
              "properties": {
                "customerEmail": {
                  "type": "string",
                  "description": "Email address of the customer to send the FAQ answer to."
                },
                "query": {
                  "type": "string",
                  "description": "The customer's question, used to find the closest matching FAQ article."
                }
              },
              "required": ["customerEmail", "query"]
            }
            """;

    private final FaqRepository faqRepository;
    private final JsonNode schema;

    public AnswerFaqTool(FaqRepository faqRepository, ObjectMapper objectMapper) {
        this.faqRepository = faqRepository;
        this.schema = ToolSchemas.parse(objectMapper, SCHEMA_JSON);
    }

    @Override
    public String name() {
        return "answer_faq";
    }

    @Override
    public RiskTier riskTier() {
        return RiskTier.SAFE;
    }

    @Override
    public String description() {
        return "Answers a customer's question using the FAQ knowledge base (data export, API "
                + "access, notifications, team members, mobile app, dark mode, 2FA, SSO). Use for "
                + "how-to and \"does the product support X\" questions.";
    }

    @Override
    public JsonNode inputSchema() {
        return schema;
    }

    @Override
    public void validateParameters(JsonNode parameters) {
        ToolSchemas.requireNonBlankEmail(parameters, "customerEmail");
        ToolSchemas.requireNonBlankText(parameters, "query");
    }

    @Override
    public ToolExecutionResult execute(JsonNode parameters) {
        String email = parameters.get("customerEmail").asText();
        String query = parameters.get("query").asText();

        FaqMatch match = faqRepository.findBestMatch(query);
        log.info("Answering FAQ query from {} with article {} (matchedKeywords={})",
                email, match.article().id(), match.matchedKeywordCount());

        return new ToolExecutionResult(
                "Sent FAQ answer \"" + match.article().question() + "\" to " + email,
                new FaqAnswer(match.article().id(), match.article().answer(), match.isConfidentMatch()));
    }

    private record FaqAnswer(String articleId, String answer, boolean confidentMatch) {
    }
}
