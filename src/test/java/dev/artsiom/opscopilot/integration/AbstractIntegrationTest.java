package dev.artsiom.opscopilot.integration;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

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
}
