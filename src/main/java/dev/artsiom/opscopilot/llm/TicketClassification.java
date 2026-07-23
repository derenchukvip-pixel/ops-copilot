package dev.artsiom.opscopilot.llm;

import dev.artsiom.opscopilot.domain.TicketCategory;

import java.math.BigDecimal;

/**
 * Result of FR2 classification: the category, a 0-1 confidence score, and a short human-readable
 * justification the audit log and operator UI both surface — never just a bare label.
 */
public record TicketClassification(TicketCategory category, BigDecimal confidence, String reasoning) {
}
