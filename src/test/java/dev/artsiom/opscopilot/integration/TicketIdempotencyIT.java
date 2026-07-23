package dev.artsiom.opscopilot.integration;

import dev.artsiom.opscopilot.repository.TicketRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the NFR from the spec: "тот же вебхук отправлен 3 раза подряд -> одно действие в БД."
 * This is the test the Definition of Done explicitly calls out.
 */
class TicketIdempotencyIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TicketRepository ticketRepository;

    @Test
    void resubmittingSameExternalIdThreeTimesCreatesExactlyOneTicket() throws Exception {
        String payload = """
                {
                  "externalId": "webhook-ext-001",
                  "customerEmail": "customer@example.com",
                  "subject": "Forgot my password",
                  "body": "I can't log in, please reset my password.",
                  "receivedAt": "2026-01-15T10:00:00Z"
                }
                """;

        mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.externalId").value("webhook-ext-001"));

        mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.externalId").value("webhook-ext-001"));

        mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.externalId").value("webhook-ext-001"));

        assertThat(ticketRepository.findAll())
                .filteredOn(t -> t.getExternalId().equals("webhook-ext-001"))
                .hasSize(1);
    }

    @Test
    void differentExternalIdsCreateSeparateTickets() throws Exception {
        String template = """
                {
                  "externalId": "%s",
                  "customerEmail": "customer@example.com",
                  "subject": "Billing question",
                  "body": "Where is my invoice?",
                  "receivedAt": "2026-01-15T10:00:00Z"
                }
                """;

        mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON)
                        .content(template.formatted("ext-a")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tickets").contentType(MediaType.APPLICATION_JSON)
                        .content(template.formatted("ext-b")))
                .andExpect(status().isCreated());

        assertThat(ticketRepository.findAll())
                .extracting("externalId")
                .contains("ext-a", "ext-b");
    }
}
