package dev.artsiom.opscopilot.config;

import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Applies the Anthropic call timeout to the auto-configured {@code RestClient.Builder} bean.
 * Kept as a customizer (rather than setting a request factory inside ClaudeLlmClient itself) so
 * unit tests can bind a fresh builder straight to MockRestServiceServer without this timeout
 * factory clobbering the mock's own request factory.
 */
@Configuration
public class LlmClientConfig {

    @Bean
    public RestClientCustomizer anthropicTimeoutCustomizer(AnthropicProperties anthropicProperties) {
        return builder -> builder.requestFactory(ClientHttpRequestFactories.get(
                ClientHttpRequestFactorySettings.DEFAULTS
                        .withConnectTimeout(Duration.ofMillis(anthropicProperties.timeoutMs()))
                        .withReadTimeout(Duration.ofMillis(anthropicProperties.timeoutMs()))));
    }
}
