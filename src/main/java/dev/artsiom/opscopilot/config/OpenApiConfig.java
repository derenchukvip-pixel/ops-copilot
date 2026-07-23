package dev.artsiom.opscopilot.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI opsCopilotOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Ops Copilot API")
                .description("AI agent for support ticket triage — classifies incoming tickets, "
                        + "auto-resolves safe cases, and queues risky actions for operator approval.")
                .version("v0.1.0"));
    }
}
