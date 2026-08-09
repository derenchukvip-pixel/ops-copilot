package dev.artsiom.opscopilot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Origins allowed to call the API from a browser. Bound from {@code ops-copilot.cors.*}.
 *
 * <p>This exists because the operator console (see {@code console/}) is a static site served
 * from a different origin than the API, and without an explicit allowlist the browser blocks
 * every request before it is sent — the approval queue would simply never load.
 *
 * <p>The default is an empty list, which means no cross-origin browser client can reach the API
 * unless someone deliberately names one. A wildcard is not offered: the endpoints here approve
 * refunds and change subscription plans, and the safe default for that is "nobody".
 */
@ConfigurationProperties(prefix = "ops-copilot.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
    }

    public boolean isEnabled() {
        return !allowedOrigins.isEmpty();
    }
}
