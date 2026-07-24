package dev.artsiom.opscopilot.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.config.AgentProperties;
import dev.artsiom.opscopilot.config.AnthropicProperties;
import dev.artsiom.opscopilot.domain.TicketCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.List;

/**
 * {@link LlmClient} backed by direct calls to the Anthropic Messages API (tool use), rather than
 * a vendored SDK — there is no official Anthropic Java SDK published on Maven Central at the
 * time of writing. Every call forces a specific tool via tool_choice, so responses are always
 * structured — no free-text parsing anywhere in this class.
 */
@Component
public class ClaudeLlmClient implements LlmClient {

    private static final Logger log = LoggerFactory.getLogger(ClaudeLlmClient.class);
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AgentProperties.RetryConfig retryConfig;
    private final AnthropicProperties anthropicProperties;
    private final JsonNode classificationSchema;

    public ClaudeLlmClient(AnthropicProperties anthropicProperties, AgentProperties agentProperties,
                            RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.anthropicProperties = anthropicProperties;
        this.retryConfig = agentProperties.llmRetry();
        this.classificationSchema = parseSchema(objectMapper, ClassificationPrompt.INPUT_SCHEMA_JSON);
        this.restClient = restClientBuilder
                .baseUrl(anthropicProperties.baseUrl())
                .defaultHeader("x-api-key", anthropicProperties.apiKey())
                .defaultHeader("anthropic-version", ANTHROPIC_VERSION)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    private static JsonNode parseSchema(ObjectMapper objectMapper, String schemaJson) {
        try {
            return objectMapper.readTree(schemaJson);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid tool schema", e);
        }
    }

    @Override
    public ClassificationResult classifyTicket(String subject, String body) {
        AnthropicApi.MessageRequest request = new AnthropicApi.MessageRequest(
                anthropicProperties.model(),
                anthropicProperties.maxTokens(),
                ClassificationPrompt.SYSTEM_PROMPT,
                List.of(new AnthropicApi.Message("user", ClassificationPrompt.userMessage(subject, body))),
                List.of(new AnthropicApi.Tool(ClassificationPrompt.TOOL_NAME,
                        "Classify a support ticket by intent category with a confidence score.",
                        classificationSchema)),
                new AnthropicApi.ToolChoice("tool", ClassificationPrompt.TOOL_NAME)
        );

        AnthropicApi.MessageResponse response = sendWithRetry(request);
        return toClassificationResult(response);
    }

    @Override
    public ParameterExtractionResult extractParameters(String subject, String body, String toolName,
                                                         String toolDescription, JsonNode inputSchema) {
        AnthropicApi.MessageRequest request = new AnthropicApi.MessageRequest(
                anthropicProperties.model(),
                anthropicProperties.maxTokens(),
                ParameterExtractionPrompt.systemPrompt(toolName),
                List.of(new AnthropicApi.Message("user", ParameterExtractionPrompt.userMessage(subject, body))),
                List.of(new AnthropicApi.Tool(toolName, toolDescription, inputSchema)),
                new AnthropicApi.ToolChoice("tool", toolName)
        );

        AnthropicApi.MessageResponse response = sendWithRetry(request);
        return toParameterExtractionResult(response);
    }

    private AnthropicApi.MessageResponse sendWithRetry(AnthropicApi.MessageRequest request) {
        int attempt = 0;
        long backoffMs = retryConfig.initialBackoffMs();
        RuntimeException lastFailure = null;

        while (attempt < retryConfig.maxAttempts()) {
            attempt++;
            try {
                return restClient.post()
                        .uri("/v1/messages")
                        .body(request)
                        .retrieve()
                        .body(AnthropicApi.MessageResponse.class);
            } catch (RestClientResponseException e) {
                if (!isRetryable(e)) {
                    throw new LlmException("Anthropic API rejected the request (status "
                            + e.getStatusCode().value() + "): " + safeBody(e), e);
                }
                lastFailure = e;
                log.warn("Anthropic API call failed (attempt {}/{}, status {}), retrying in {}ms",
                        attempt, retryConfig.maxAttempts(), e.getStatusCode().value(), backoffMs);
            } catch (RestClientException e) {
                lastFailure = e;
                log.warn("Anthropic API call failed (attempt {}/{}): {}, retrying in {}ms",
                        attempt, retryConfig.maxAttempts(), e.getMessage(), backoffMs);
            }

            if (attempt < retryConfig.maxAttempts()) {
                sleep(backoffMs);
                backoffMs = (long) (backoffMs * retryConfig.backoffMultiplier());
            }
        }

        throw new LlmException("Anthropic API call failed after " + retryConfig.maxAttempts() + " attempts",
                lastFailure);
    }

    private boolean isRetryable(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        // 429 (rate limited) and 5xx (transient server issues) are worth retrying;
        // 4xx otherwise (bad request, auth) will fail identically every time.
        return status == 429 || status >= 500;
    }

    private String safeBody(RestClientResponseException e) {
        String responseBody = e.getResponseBodyAsString();
        try {
            AnthropicApi.ErrorResponse error = objectMapper.readValue(responseBody, AnthropicApi.ErrorResponse.class);
            return error.error() != null ? error.error().message() : responseBody;
        } catch (Exception parseFailure) {
            return responseBody;
        }
    }

    private AnthropicApi.ContentBlock findToolUseBlock(AnthropicApi.MessageResponse response) {
        return response.content().stream()
                .filter(block -> "tool_use".equals(block.type()))
                .findFirst()
                .orElseThrow(() -> new LlmException("Anthropic response contained no tool_use block"));
    }

    private ClassificationResult toClassificationResult(AnthropicApi.MessageResponse response) {
        JsonNode input = findToolUseBlock(response).input();
        TicketCategory category = TicketCategory.fromWireValue(input.get("category").asText());
        BigDecimal confidence = new BigDecimal(input.get("confidence").asText());
        String reasoning = input.get("reasoning").asText();

        TicketClassification classification = new TicketClassification(category, confidence, reasoning);
        int inputTokens = response.usage() != null ? response.usage().inputTokens() : 0;
        int outputTokens = response.usage() != null ? response.usage().outputTokens() : 0;
        return new ClassificationResult(classification, inputTokens, outputTokens);
    }

    private ParameterExtractionResult toParameterExtractionResult(AnthropicApi.MessageResponse response) {
        JsonNode input = findToolUseBlock(response).input();
        int inputTokens = response.usage() != null ? response.usage().inputTokens() : 0;
        int outputTokens = response.usage() != null ? response.usage().outputTokens() : 0;
        return new ParameterExtractionResult(input, inputTokens, outputTokens);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LlmException("Interrupted while backing off before retry", e);
        }
    }
}
