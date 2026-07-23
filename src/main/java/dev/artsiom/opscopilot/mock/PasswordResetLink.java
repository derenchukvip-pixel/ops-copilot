package dev.artsiom.opscopilot.mock;

import java.time.Instant;

public record PasswordResetLink(String token, String url, Instant expiresAt) {
}
