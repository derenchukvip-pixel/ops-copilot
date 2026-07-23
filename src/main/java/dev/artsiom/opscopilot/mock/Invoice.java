package dev.artsiom.opscopilot.mock;

import java.math.BigDecimal;
import java.time.Instant;

public record Invoice(String id, BigDecimal amount, String currency, Instant issuedAt, String downloadUrl) {
}
