package dev.artsiom.opscopilot.dto;

import jakarta.validation.constraints.NotBlank;

public record RejectActionRequest(@NotBlank String reason, String reviewedBy) {
}
