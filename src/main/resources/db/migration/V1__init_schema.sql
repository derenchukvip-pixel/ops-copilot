-- Core ticket lifecycle table. externalId is the idempotency key for FR1/FR7.
CREATE TABLE tickets (
    id              BIGSERIAL PRIMARY KEY,
    external_id     VARCHAR(255) NOT NULL,
    customer_email  VARCHAR(320) NOT NULL,
    subject         VARCHAR(500) NOT NULL,
    body            TEXT NOT NULL,
    status          VARCHAR(30) NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tickets_external_id UNIQUE (external_id),
    CONSTRAINT chk_tickets_status CHECK (status IN
        ('RECEIVED', 'PROCESSING', 'RESOLVED_AUTO', 'PENDING_APPROVAL', 'ESCALATED', 'ERROR'))
);

-- One row per LLM classification made during a ticket's agent run.
CREATE TABLE agent_decisions (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   BIGINT NOT NULL REFERENCES tickets (id),
    category    VARCHAR(50) NOT NULL,
    confidence  NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reasoning   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_agent_decisions_category CHECK (category IN
        ('password_reset', 'billing_invoice_request', 'plan_change_request', 'refund_request',
         'bug_report', 'feature_request', 'spam_or_abuse', 'unclear'))
);

CREATE INDEX idx_agent_decisions_ticket_id ON agent_decisions (ticket_id);

-- Every tool invocation attempt, safe or approval-gated, successful or not.
CREATE TABLE tool_calls (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT NOT NULL REFERENCES tickets (id),
    tool_name       VARCHAR(100) NOT NULL,
    parameters      JSONB NOT NULL,
    result          JSONB,
    status          VARCHAR(20) NOT NULL,
    attempt_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tool_calls_status CHECK (status IN ('SUCCESS', 'FAILED', 'RETRIED'))
);

CREATE INDEX idx_tool_calls_ticket_id ON tool_calls (ticket_id);

-- Queue of requires-approval actions. Execution is gated by an atomic
-- UPDATE ... WHERE status = 'PENDING' in PendingActionRepository so a
-- PendingAction can never be executed twice, even under concurrent approve calls.
CREATE TABLE pending_actions (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT NOT NULL REFERENCES tickets (id),
    tool_name       VARCHAR(100) NOT NULL,
    parameters      JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by     VARCHAR(255),
    reviewed_at     TIMESTAMPTZ,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pending_actions_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_pending_actions_ticket_id ON pending_actions (ticket_id);
CREATE INDEX idx_pending_actions_status ON pending_actions (status);

-- Append-only audit trail. No application code path updates or deletes rows here;
-- the triggers below make that a hard guarantee enforced by the database itself,
-- not just an application convention that a future bug could violate.
CREATE TABLE audit_log_entries (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   BIGINT NOT NULL REFERENCES tickets (id),
    event_type  VARCHAR(50) NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_audit_log_event_type CHECK (event_type IN
        ('TICKET_RECEIVED', 'CLASSIFIED', 'TOOL_CALLED', 'TOOL_RESULT',
         'ACTION_AUTO_EXECUTED', 'ACTION_QUEUED_FOR_APPROVAL', 'ACTION_APPROVED',
         'ACTION_REJECTED', 'ESCALATED_TO_HUMAN', 'ERROR'))
);

CREATE INDEX idx_audit_log_entries_ticket_id ON audit_log_entries (ticket_id);

CREATE FUNCTION reject_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log_entries is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
    BEFORE UPDATE ON audit_log_entries
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

CREATE TRIGGER trg_audit_log_no_delete
    BEFORE DELETE ON audit_log_entries
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
