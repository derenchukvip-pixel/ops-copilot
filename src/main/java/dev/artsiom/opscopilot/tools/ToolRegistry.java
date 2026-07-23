package dev.artsiom.opscopilot.tools;

import dev.artsiom.opscopilot.exception.UnknownToolException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The FR8 allowlist. Spring collects every {@link Tool} bean into the constructor list — a tool
 * exists in this registry if and only if it's a real, code-reviewed implementation. There is no
 * path from an LLM response straight into tool execution; {@link #get} is the only lookup, and
 * it throws for anything not registered, including a name the model invents.
 */
@Component
public class ToolRegistry {

    private final Map<String, Tool> toolsByName;

    public ToolRegistry(List<Tool> tools) {
        this.toolsByName = tools.stream()
                .collect(Collectors.toUnmodifiableMap(Tool::name, Function.identity()));
    }

    public Tool get(String name) {
        Tool tool = toolsByName.get(name);
        if (tool == null) {
            throw new UnknownToolException(name);
        }
        return tool;
    }

    public List<Tool> allTools() {
        return List.copyOf(toolsByName.values());
    }
}
