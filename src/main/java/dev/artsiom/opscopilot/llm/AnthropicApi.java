package dev.artsiom.opscopilot.llm;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * Minimal wire-format types for the Anthropic Messages API (tool use) — just enough to send one
 * forced tool call and read back its result. Not a general-purpose client; see {@link ClaudeLlmClient}.
 */
final class AnthropicApi {

    private AnthropicApi() {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record MessageRequest(
            String model,
            @JsonProperty("max_tokens") int maxTokens,
            String system,
            List<Message> messages,
            List<Tool> tools,
            @JsonProperty("tool_choice") ToolChoice toolChoice
    ) {
    }

    record Message(String role, String content) {
    }

    record Tool(String name, String description, @JsonProperty("input_schema") JsonNode inputSchema) {
    }

    record ToolChoice(String type, String name) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record MessageResponse(
            String id,
            String type,
            String role,
            List<ContentBlock> content,
            @JsonProperty("stop_reason") String stopReason,
            Usage usage
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ContentBlock(String type, String text, String id, String name, JsonNode input) {
    }

    record Usage(@JsonProperty("input_tokens") int inputTokens, @JsonProperty("output_tokens") int outputTokens) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ErrorResponse(String type, ErrorDetail error) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ErrorDetail(String type, String message) {
    }
}
