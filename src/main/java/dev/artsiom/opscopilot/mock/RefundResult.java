package dev.artsiom.opscopilot.mock;

import java.math.BigDecimal;

public record RefundResult(String refundId, BigDecimal amount, String status) {
}
