package dev.artsiom.opscopilot.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.artsiom.opscopilot.domain.PendingAction;
import dev.artsiom.opscopilot.domain.Ticket;
import dev.artsiom.opscopilot.domain.TicketStatus;
import dev.artsiom.opscopilot.repository.TicketRepository;
import dev.artsiom.opscopilot.repository.ToolCallRepository;
import dev.artsiom.opscopilot.service.PendingActionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * FR7: "одно PendingAction не может быть выполнено дважды — атомарная проверка статуса перед
 * execute". Fires two concurrent approve requests at the same PendingAction and asserts exactly
 * one wins and exactly one ToolCall row is created — the atomic
 * {@code UPDATE ... WHERE status = 'PENDING'} in PendingActionRepository is what makes this true
 * regardless of request timing, not application-level locking.
 */
class PendingActionApprovalIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private ToolCallRepository toolCallRepository;

    @Autowired
    private PendingActionService pendingActionService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void concurrentApprovalsExecuteTheActionExactlyOnce() throws Exception {
        Ticket ticket = ticketRepository.saveAndFlush(new Ticket(
                "approval-concurrency-ext-1", "carol@acme.io", "Please upgrade my plan",
                "I'd like to move to the pro plan.", Instant.now()));
        ticket.setStatus(TicketStatus.PENDING_APPROVAL);
        ticketRepository.saveAndFlush(ticket);

        var parameters = objectMapper.readTree("""
                {"customerEmail": "carol@acme.io", "targetPlan": "pro"}
                """);
        PendingAction pendingAction = pendingActionService.createPendingAction(
                ticket.getId(), "change_subscription_plan", parameters);

        int concurrentRequests = 5;
        ExecutorService executor = Executors.newFixedThreadPool(concurrentRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        List<Callable<Integer>> tasks = java.util.stream.IntStream.range(0, concurrentRequests)
                .<Callable<Integer>>mapToObj(i -> () -> {
                    startLatch.await();
                    return mockMvc.perform(post("/api/pending-actions/{id}/approve", pendingAction.getId())
                                    .contentType(MediaType.APPLICATION_JSON))
                            .andReturn().getResponse().getStatus();
                })
                .toList();

        List<Future<Integer>> futures = tasks.stream().map(executor::submit).toList();
        startLatch.countDown();

        long successCount = 0;
        long conflictCount = 0;
        for (Future<Integer> future : futures) {
            int status = future.get(10, TimeUnit.SECONDS);
            if (status == 200) {
                successCount++;
            } else if (status == 409) {
                conflictCount++;
            }
        }
        executor.shutdown();

        assertThat(successCount).isEqualTo(1);
        assertThat(conflictCount).isEqualTo(concurrentRequests - 1);
        assertThat(toolCallRepository.findByTicketIdOrderByCreatedAtAsc(ticket.getId())).hasSize(1);
    }
}
