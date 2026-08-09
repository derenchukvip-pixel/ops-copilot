package dev.artsiom.opscopilot;

import dev.artsiom.opscopilot.config.AgentProperties;
import dev.artsiom.opscopilot.config.AnthropicProperties;
import dev.artsiom.opscopilot.config.CorsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({AgentProperties.class, AnthropicProperties.class, CorsProperties.class})
public class OpsCopilotApplication {

    public static void main(String[] args) {
        SpringApplication.run(OpsCopilotApplication.class, args);
    }
}
