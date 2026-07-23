package dev.artsiom.opscopilot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "tool_calls")
public class ToolCall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "tool_name", nullable = false, length = 100)
    private String toolName;

    /** Raw JSON text, stored as jsonb. Serialization/deserialization is the caller's responsibility. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String parameters;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private String result;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ToolCallStatus status;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ToolCall() {
        // JPA
    }

    public ToolCall(Long ticketId, String toolName, String parameters) {
        this.ticketId = ticketId;
        this.toolName = toolName;
        this.parameters = parameters;
        this.status = ToolCallStatus.RETRIED;
        this.attemptCount = 0;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void recordAttempt(ToolCallStatus status, String result) {
        this.attemptCount++;
        this.status = status;
        this.result = result;
    }

    public Long getId() {
        return id;
    }

    public Long getTicketId() {
        return ticketId;
    }

    public String getToolName() {
        return toolName;
    }

    public String getParameters() {
        return parameters;
    }

    public String getResult() {
        return result;
    }

    public ToolCallStatus getStatus() {
        return status;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
