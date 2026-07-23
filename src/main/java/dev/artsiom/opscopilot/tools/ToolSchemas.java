package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Small shared helpers so every {@link Tool} implementation doesn't re-write the same
 * "parse my schema constant once" and "this required field is missing/blank" boilerplate.
 */
final class ToolSchemas {

    private ToolSchemas() {
    }

    static JsonNode parse(ObjectMapper objectMapper, String schemaJson) {
        try {
            return objectMapper.readTree(schemaJson);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid tool input schema", e);
        }
    }

    static String requireNonBlankEmail(JsonNode parameters, String field) {
        JsonNode node = parameters.get(field);
        if (node == null || node.asText("").isBlank()) {
            throw new ToolValidationException("Missing required field: " + field);
        }
        String value = node.asText();
        if (!value.contains("@")) {
            throw new ToolValidationException(field + " is not a valid email address: " + value);
        }
        return value;
    }

    static String requireNonBlankText(JsonNode parameters, String field) {
        JsonNode node = parameters.get(field);
        if (node == null || node.asText("").isBlank()) {
            throw new ToolValidationException("Missing required field: " + field);
        }
        return node.asText();
    }
}
