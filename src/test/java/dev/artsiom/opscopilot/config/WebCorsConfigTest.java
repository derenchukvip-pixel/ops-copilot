package dev.artsiom.opscopilot.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The approval endpoints are reached from a browser on another origin, so the allowlist is the
 * thing standing between "the console can load the queue" and "any page on the internet can
 * approve a refund". Both directions are worth a test.
 */
class WebCorsConfigTest {

    /** {@code getCorsConfigurations} is protected on the registry; a subclass can read it. */
    private static final class InspectableRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> configurations() {
            return getCorsConfigurations();
        }
    }

    private Map<String, CorsConfiguration> register(List<String> origins) {
        InspectableRegistry registry = new InspectableRegistry();
        new WebCorsConfig(new CorsProperties(origins)).addCorsMappings(registry);
        return registry.configurations();
    }

    @Test
    @DisplayName("registers nothing when no origins are configured")
    void noMappingWithoutOrigins() {
        assertThat(register(List.of())).isEmpty();
        assertThat(register(null)).isEmpty();
    }

    @Test
    @DisplayName("allows the configured origins on /api/** and nothing else")
    void registersConfiguredOrigins() {
        Map<String, CorsConfiguration> configurations =
                register(List.of("http://localhost:3000", "https://derenchukvip-pixel.github.io"));

        assertThat(configurations).containsOnlyKeys("/api/**");

        CorsConfiguration configuration = configurations.get("/api/**");
        assertThat(configuration.getAllowedOriginPatterns())
                .containsExactly("http://localhost:3000", "https://derenchukvip-pixel.github.io");
        assertThat(configuration.getAllowedOrigins()).isNull();
    }

    @Test
    @DisplayName("permits only the verbs the console uses")
    void restrictsMethods() {
        CorsConfiguration configuration = register(List.of("http://localhost:3000")).get("/api/**");

        assertThat(configuration.getAllowedMethods()).containsExactlyInAnyOrder("GET", "POST");
        assertThat(configuration.getAllowedMethods()).doesNotContain("DELETE", "PUT", "PATCH");
    }

    @Test
    @DisplayName("does not allow credentials — there is no session to carry")
    void doesNotAllowCredentials() {
        CorsConfiguration configuration = register(List.of("http://localhost:3000")).get("/api/**");

        assertThat(configuration.getAllowCredentials()).isFalse();
    }

    @Test
    @DisplayName("an unlisted origin is not matched by the registered configuration")
    void unlistedOriginIsRejected() {
        CorsConfiguration configuration = register(List.of("https://console.example")).get("/api/**");

        assertThat(configuration.checkOrigin("https://console.example"))
                .isEqualTo("https://console.example");
        assertThat(configuration.checkOrigin("https://evil.example")).isNull();
    }
}

/**
 * Separate holder so the properties record's own contract is covered without a registry.
 */
class CorsPropertiesTest {

    @Test
    @DisplayName("treats a missing list as no origins rather than failing at startup")
    void nullBecomesEmpty() {
        assertThat(new CorsProperties(null).allowedOrigins()).isEmpty();
        assertThat(new CorsProperties(null).isEnabled()).isFalse();
    }

    @Test
    @DisplayName("is enabled only when at least one origin is named")
    void enabledWithOrigins() {
        assertThat(new CorsProperties(List.of()).isEnabled()).isFalse();
        assertThat(new CorsProperties(List.of("https://console.example")).isEnabled()).isTrue();
    }

    @Test
    @DisplayName("copies the list so a caller cannot widen the allowlist after construction")
    void listIsImmutable() {
        List<String> mutable = new java.util.ArrayList<>(List.of("https://console.example"));
        CorsProperties properties = new CorsProperties(mutable);

        mutable.add("https://evil.example");

        assertThat(properties.allowedOrigins()).containsExactly("https://console.example");
        assertThatThrownBy(() -> properties.allowedOrigins().add("https://evil.example"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
