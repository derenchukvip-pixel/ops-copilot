package dev.artsiom.opscopilot.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.config.AgentProperties;
import dev.artsiom.opscopilot.config.AnthropicProperties;
import dev.artsiom.opscopilot.domain.TicketCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Verifies the retry/backoff contract from FR7 without hitting the real Anthropic API:
 * transient failures (5xx) retry up to the configured limit, non-retryable failures (4xx) fail
 * fast, and a successful tool_use response parses into a {@link ClassificationResult}.
 */
class ClaudeLlmClientTest {

    private static final String SUCCESS_BODY = """
            {
              "id": "msg_1",
              "type": "message",
              "role": "assistant",
              "content": [
                {
                  "type": "tool_use",
                  "id": "toolu_1",
                  "name": "classify_ticket",
                  "input": {
                    "category": "password_reset",
                    "confidence": 0.95,
                    "reasoning": "Customer explicitly says they are locked out and want a reset."
                  }
                }
              ],
              "stop_reason": "tool_use",
              "usage": { "input_tokens": 120, "output_tokens": 40 }
            }
            """;

    private MockRestServiceServer mockServer;
    private ClaudeLlmClient client;

    @BeforeEach
    void setUp() {
        AnthropicProperties anthropicProperties = new AnthropicProperties(
                "test-key", "https://api.anthropic.com", "claude-sonnet-5", 1024, 5000);
        AgentProperties.RetryConfig retryConfig = new AgentProperties.RetryConfig(3, 10, 2.0);
        AgentProperties agentProperties = new AgentProperties(
                new BigDecimal("0.85"), 6, 20000, retryConfig, retryConfig);

        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        client = new ClaudeLlmClient(anthropicProperties, agentProperties, builder, new ObjectMapper());
    }

    @Test
    void parsesSuccessfulToolUseResponse() {
        mockServer.expect(requestTo("https://api.anthropic.com/v1/messages"))
                .andExpect(method(POST))
                .andRespond(withSuccess(SUCCESS_BODY, MediaType.APPLICATION_JSON));

        ClassificationResult result = client.classifyTicket("Forgot password", "I can't log in");

        assertThat(result.classification().category()).isEqualTo(TicketCategory.PASSWORD_RESET);
        assertThat(result.classification().confidence()).isEqualByComparingTo("0.95");
        assertThat(result.inputTokens()).isEqualTo(120);
        assertThat(result.outputTokens()).isEqualTo(40);
        mockServer.verify();
    }

    @Test
    void retriesOnServerErrorThenSucceeds() {
        mockServer.expect(requestTo("https://api.anthropic.com/v1/messages"))
                .andRespond(withStatus(INTERNAL_SERVER_ERROR).body("{\"type\":\"error\"}"));
        mockServer.expect(requestTo("https://api.anthropic.com/v1/messages"))
                .andRespond(withSuccess(SUCCESS_BODY, MediaType.APPLICATION_JSON));

        ClassificationResult result = client.classifyTicket("Forgot password", "I can't log in");

        assertThat(result.classification().category()).isEqualTo(TicketCategory.PASSWORD_RESET);
        mockServer.verify();
    }

    @Test
    void doesNotRetryOnBadRequestAndFailsFast() {
        mockServer.expect(requestTo("https://api.anthropic.com/v1/messages"))
                .andRespond(withStatus(BAD_REQUEST)
                        .body("{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"bad schema\"}}")
                        .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.classifyTicket("Forgot password", "I can't log in"))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("bad schema");

        mockServer.verify();
    }
}
