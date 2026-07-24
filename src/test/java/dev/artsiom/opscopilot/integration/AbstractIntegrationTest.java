package dev.artsiom.opscopilot.integration;

import dev.artsiom.opscopilot.domain.TicketCategory;
import dev.artsiom.opscopilot.llm.ClassificationResult;
import dev.artsiom.opscopilot.llm.LlmClient;
import dev.artsiom.opscopilot.llm.TicketClassification;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Base class for integration tests that need a real Postgres.
 *
 * <p>Deliberately NOT using {@code @Testcontainers}/{@code @Container}: that annotation pair
 * stops the container in each test class's {@code afterAll}, even though the {@code POSTGRES}
 * field is a single static instance shared via inheritance. The next IT class then restarts the
 * same container object on a new random host port, but Spring's test context cache still holds
 * the previous (now-dead) JDBC URL, since the two classes share an identical context
 * configuration and Spring only builds the DataSource once per cache key. The result is
 * "Connection refused" on the second IT class in a full {@code mvn verify} run, despite each IT
 * passing individually. This is Testcontainers' documented "singleton container" pattern: start
 * it once in a static initializer and let the JVM shut it down.
 *
 * <p>{@link LlmClient} is mocked here rather than left as the real {@code ClaudeLlmClient} bean:
 * without that, every IT that posts a ticket would make a real network call to Anthropic (and
 * fail with 401, since no test environment has a real API key configured) — slow, non-hermetic,
 * and liable to behave differently the moment someone's shell happens to export a real key. The
 * default stub returns UNCLEAR at low confidence, which escalates without touching any tool —
 * harmless for tests (like the idempotency ones) that don't care what the classification was.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("ops_copilot_test")
            .withUsername("test")
            .withPassword("test");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @MockBean
    protected LlmClient llmClient;

    @BeforeEach
    void stubLlmClientByDefault() {
        lenient().when(llmClient.classifyTicket(any(), any())).thenReturn(new ClassificationResult(
                new TicketClassification(TicketCategory.UNCLEAR, new BigDecimal("0.50"), "stubbed for integration test"),
                10, 10));
    }
}
