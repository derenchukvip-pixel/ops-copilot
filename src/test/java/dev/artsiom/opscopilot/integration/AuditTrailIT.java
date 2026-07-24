package dev.artsiom.opscopilot.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.domain.TicketCategory;
import dev.artsiom.opscopilot.llm.ClassificationResult;
import dev.artsiom.opscopilot.llm.TicketClassification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FR6: "Aудит-лог по любому тикету показывает полную честную историю решений" — this test
 * submits a ticket that auto-resolves through a SAFE tool and asserts the audit trail records
 * every step of that path, in order, exactly as it happened.
 */
class AuditTrailIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void stubHighConfidencePasswordReset() {
        when(llmClient.classifyTicket(any(), any())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.PASSWORD_RESET, new BigDecimal("0.95"),
                        "Customer explicitly asks for a password reset"),
                42, 17));
    }

    @Test
    void autoResolvedTicketHasACompleteOrderedAuditTrail() throws Exception {
        String payload = """
                {
                  "externalId": "audit-trail-ext-1",
                  "customerEmail": "alice@acme.io",
                  "subject": "Forgot my password",
                  "body": "I can't log in, please reset my password.",
                  "receivedAt": "2026-01-15T10:00:00Z"
                }
                """;

        String response = mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("RESOLVED_AUTO"))
                .andReturn().getResponse().getContentAsString();

        long ticketId = objectMapper.readTree(response).get("id").asLong();

        String auditLogJson = mockMvc.perform(get("/api/tickets/{id}/audit-log", ticketId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode entries = objectMapper.readTree(auditLogJson);
        List<String> eventTypes = new ArrayList<>();
        entries.forEach(entry -> eventTypes.add(entry.get("eventType").asText()));

        assertThat(eventTypes).containsExactly(
                "TICKET_RECEIVED", "CLASSIFIED", "TOOL_CALLED", "TOOL_RESULT", "ACTION_AUTO_EXECUTED");

        JsonNode classifiedPayload = entries.get(1).get("payload");
        assertThat(classifiedPayload.get("category").asText()).isEqualTo("password_reset");
        assertThat(classifiedPayload.get("confidence").asText()).isEqualTo("0.95");
    }
}
