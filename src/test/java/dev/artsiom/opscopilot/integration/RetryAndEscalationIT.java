package dev.artsiom.opscopilot.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.llm.LlmException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

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
 * FR7: "при исчерпании [retries] — тикет уходит в ERROR-статус и эскалируется на человека, не
 * зависает молча." The actual retry loop lives in ClaudeLlmClient (unit-tested against a mock
 * HTTP server in ClaudeLlmClientTest) and RetryExecutor (unit-tested in RetryExecutorTest) — what
 * this test proves end-to-end, through the real HTTP + Postgres stack, is the consequence of
 * exhaustion: the ticket never gets stuck in PROCESSING, and a human can find out why.
 */
class RetryAndEscalationIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void stubClassificationAsExhausted() {
        when(llmClient.classifyTicket(any(), any()))
                .thenThrow(new LlmException("Anthropic API call failed after 3 attempts"));
    }

    @Test
    void ticketMovesToErrorAndEscalatesWhenLlmRetriesAreExhausted() throws Exception {
        String payload = """
                {
                  "externalId": "retry-exhaustion-ext-1",
                  "customerEmail": "dave@acme.io",
                  "subject": "Question",
                  "body": "Something about my account.",
                  "receivedAt": "2026-01-15T10:00:00Z"
                }
                """;

        String response = mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andReturn().getResponse().getContentAsString();

        long ticketId = objectMapper.readTree(response).get("id").asLong();

        String auditLogJson = mockMvc.perform(get("/api/tickets/{id}/audit-log", ticketId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode entries = objectMapper.readTree(auditLogJson);
        List<String> eventTypes = new ArrayList<>();
        entries.forEach(entry -> eventTypes.add(entry.get("eventType").asText()));

        assertThat(eventTypes).containsExactly("TICKET_RECEIVED", "ERROR", "ESCALATED_TO_HUMAN");
    }
}
