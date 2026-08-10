package dev.artsiom.opscopilot.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers the CORS allowlist from {@link CorsProperties} for {@code /api/**}.
 *
 * <p>Only the verbs the console actually uses are permitted (GET for reads, POST for
 * approve/reject/ingest), and credentials are deliberately not allowed: there is no session or
 * cookie in this system, the console sends plain JSON, and enabling credentials would rule out
 * ever falling back to a wildcard origin while adding nothing today.
 *
 * <p>Nothing is registered at all when the allowlist is empty, so a deployment that never
 * configures an origin behaves exactly as it did before this class existed.
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebCorsConfig.class);

    /** One hour. Long enough that the browser stops re-sending preflights on every click. */
    private static final long PREFLIGHT_MAX_AGE_SECONDS = 3600;

    private final CorsProperties corsProperties;

    public WebCorsConfig(CorsProperties corsProperties) {
        this.corsProperties = corsProperties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (!corsProperties.isEnabled()) {
            log.info("CORS is disabled: no origins configured under ops-copilot.cors.allowed-origins");
            return;
        }

        log.info("CORS enabled for origins: {}", corsProperties.allowedOrigins());

        registry.addMapping("/api/**")
                // allowedOriginPatterns rather than allowedOrigins so a deployment can use a
                // pattern (a preview-deploy subdomain, say) without a second knob; exact origins
                // remain valid patterns.
                .allowedOriginPatterns(corsProperties.allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST")
                .allowedHeaders("Content-Type")
                .allowCredentials(false)
                .maxAge(PREFLIGHT_MAX_AGE_SECONDS);
    }
}
