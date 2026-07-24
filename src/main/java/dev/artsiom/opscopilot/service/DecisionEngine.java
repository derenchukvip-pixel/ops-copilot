package dev.artsiom.opscopilot.service;

import dev.artsiom.opscopilot.domain.TicketCategory;
import dev.artsiom.opscopilot.tools.RiskTier;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * FR3's decision rule as a pure function: category + confidence in, one outcome out. No I/O, no
 * Spring context needed to test it — that's deliberate, since this is the one piece of the whole
 * system that must be trivially, exhaustively unit-testable (see the NFR in section 6: "unit-тесты
 * на decision engine (given category + confidence → expected action)").
 *
 * <p>Category-to-tool mapping: password_reset, billing_invoice_request, and feature_request map
 * to SAFE tools; plan_change_request and refund_request map to REQUIRES_APPROVAL tools.
 * bug_report, spam_or_abuse, and unclear have no tool mapping at all — there is no safe automated
 * action for a bug report, and FR3 explicitly requires spam_or_abuse/unclear to escalate without
 * attempting anything. All three fall through to the same "no mapping" branch below, which is
 * intentional: the outcome is identical (escalate, no action attempted), just for different
 * underlying reasons.
 */
@Component
public class DecisionEngine {

    private static final Map<TicketCategory, ToolMapping> CATEGORY_TOOL_MAP = Map.of(
            TicketCategory.PASSWORD_RESET, new ToolMapping("send_password_reset_link", RiskTier.SAFE),
            TicketCategory.BILLING_INVOICE_REQUEST, new ToolMapping("resend_invoice", RiskTier.SAFE),
            TicketCategory.FEATURE_REQUEST, new ToolMapping("answer_faq", RiskTier.SAFE),
            TicketCategory.PLAN_CHANGE_REQUEST, new ToolMapping("change_subscription_plan", RiskTier.REQUIRES_APPROVAL),
            TicketCategory.REFUND_REQUEST, new ToolMapping("issue_refund", RiskTier.REQUIRES_APPROVAL)
    );

    public DecisionOutcome decide(TicketCategory category, BigDecimal confidence, BigDecimal confidenceThreshold) {
        ToolMapping mapping = CATEGORY_TOOL_MAP.get(category);
        if (mapping == null) {
            return new DecisionOutcome.Escalate(
                    "No automated action for category " + category.getWireValue());
        }

        if (mapping.riskTier() == RiskTier.REQUIRES_APPROVAL) {
            // Always queued regardless of confidence — a high-confidence refund request is still
            // a refund request. FR3 is explicit that requires-approval tools never auto-execute.
            return new DecisionOutcome.QueueForApproval(mapping.toolName());
        }

        if (confidence.compareTo(confidenceThreshold) >= 0) {
            return new DecisionOutcome.AutoExecute(mapping.toolName());
        }

        return new DecisionOutcome.Escalate(
                "Confidence " + confidence + " is below the threshold " + confidenceThreshold);
    }

    private record ToolMapping(String toolName, RiskTier riskTier) {
    }
}
