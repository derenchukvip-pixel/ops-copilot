package dev.artsiom.opscopilot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "agent_decisions")
public class AgentDecision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(nullable = false, length = 50)
    private TicketCategory category;

    @Column(nullable = false, precision = 4, scale = 3)
    private BigDecimal confidence;

    @Column
    private String reasoning;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AgentDecision() {
        // JPA
    }

    public AgentDecision(Long ticketId, TicketCategory category, BigDecimal confidence, String reasoning) {
        this.ticketId = ticketId;
        this.category = category;
        this.confidence = confidence;
        this.reasoning = reasoning;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getTicketId() {
        return ticketId;
    }

    public TicketCategory getCategory() {
        return category;
    }

    public BigDecimal getConfidence() {
        return confidence;
    }

    public String getReasoning() {
        return reasoning;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
