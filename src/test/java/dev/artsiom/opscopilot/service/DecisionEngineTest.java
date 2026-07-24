package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.domain.TicketCategory;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/** FR3 as a table: given category + confidence, the expected outcome. */
class DecisionEngineTest {

    private static final BigDecimal THRESHOLD = new BigDecimal("0.85");

    private final DecisionEngine decisionEngine = new DecisionEngine();

    static Stream<Arguments> safeCategoriesAboveThreshold() {
        return Stream.of(
                Arguments.of(TicketCategory.PASSWORD_RESET, "send_password_reset_link"),
                Arguments.of(TicketCategory.BILLING_INVOICE_REQUEST, "resend_invoice"),
                Arguments.of(TicketCategory.FEATURE_REQUEST, "answer_faq")
        );
    }

    @ParameterizedTest
    @MethodSource("safeCategoriesAboveThreshold")
    void autoExecutesSafeToolWhenConfidenceAtOrAboveThreshold(TicketCategory category, String expectedTool) {
        DecisionOutcome outcome = decisionEngine.decide(category, new BigDecimal("0.90"), THRESHOLD);

        assertThat(outcome).isInstanceOf(DecisionOutcome.AutoExecute.class);
        assertThat(((DecisionOutcome.AutoExecute) outcome).toolName()).isEqualTo(expectedTool);
    }

    @ParameterizedTest
    @MethodSource("safeCategoriesAboveThreshold")
    void escalatesSafeCategoryWhenConfidenceBelowThreshold(TicketCategory category, String ignoredTool) {
        DecisionOutcome outcome = decisionEngine.decide(category, new BigDecimal("0.50"), THRESHOLD);

        assertThat(outcome).isInstanceOf(DecisionOutcome.Escalate.class);
    }

    @ParameterizedTest
    @MethodSource("safeCategoriesAboveThreshold")
    void autoExecutesAtExactlyTheThreshold(TicketCategory category, String expectedTool) {
        DecisionOutcome outcome = decisionEngine.decide(category, THRESHOLD, THRESHOLD);

        assertThat(outcome).isInstanceOf(DecisionOutcome.AutoExecute.class);
    }

    @ParameterizedTest
    @MethodSource("approvalCategories")
    void alwaysQueuesRequiresApprovalToolsRegardlessOfConfidence(TicketCategory category, String expectedTool) {
        DecisionOutcome highConfidence = decisionEngine.decide(category, new BigDecimal("0.99"), THRESHOLD);
        DecisionOutcome lowConfidence = decisionEngine.decide(category, new BigDecimal("0.10"), THRESHOLD);

        assertThat(highConfidence).isInstanceOf(DecisionOutcome.QueueForApproval.class);
        assertThat(((DecisionOutcome.QueueForApproval) highConfidence).toolName()).isEqualTo(expectedTool);
        assertThat(lowConfidence).isInstanceOf(DecisionOutcome.QueueForApproval.class);
    }

    static Stream<Arguments> approvalCategories() {
        return Stream.of(
                Arguments.of(TicketCategory.PLAN_CHANGE_REQUEST, "change_subscription_plan"),
                Arguments.of(TicketCategory.REFUND_REQUEST, "issue_refund")
        );
    }

    @ParameterizedTest
    @MethodSource("noToolMappingCategories")
    void alwaysEscalatesCategoriesWithNoToolMapping(TicketCategory category) {
        DecisionOutcome highConfidence = decisionEngine.decide(category, new BigDecimal("0.99"), THRESHOLD);

        assertThat(highConfidence).isInstanceOf(DecisionOutcome.Escalate.class);
    }

    static Stream<TicketCategory> noToolMappingCategories() {
        return Stream.of(TicketCategory.BUG_REPORT, TicketCategory.SPAM_OR_ABUSE, TicketCategory.UNCLEAR);
    }
}
