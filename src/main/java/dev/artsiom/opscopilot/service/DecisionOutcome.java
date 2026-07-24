package dev.artsiom.opscopilot.service;

/**
 * What {@link DecisionEngine} decided to do about a classified ticket (FR3). A sealed type so the
 * orchestrator's switch over outcomes is exhaustive at compile time — adding a fourth outcome
 * later forces every call site to handle it.
 */
public sealed interface DecisionOutcome {

    record AutoExecute(String toolName) implements DecisionOutcome {
    }

    record QueueForApproval(String toolName) implements DecisionOutcome {
    }

    record Escalate(String reason) implements DecisionOutcome {
    }
}
