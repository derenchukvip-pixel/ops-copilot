package dev.artsiom.opscopilot.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Ticket intent categories per FR2. The wire value (used in JSON, the LLM tool schema,
 * and the DB check constraint) is lowercase snake_case; the Java constant name is the
 * conventional upper-snake form. {@link TicketCategoryConverter} persists the wire value.
 */
public enum TicketCategory {
    PASSWORD_RESET("password_reset"),
    BILLING_INVOICE_REQUEST("billing_invoice_request"),
    PLAN_CHANGE_REQUEST("plan_change_request"),
    REFUND_REQUEST("refund_request"),
    BUG_REPORT("bug_report"),
    FEATURE_REQUEST("feature_request"),
    SPAM_OR_ABUSE("spam_or_abuse"),
    UNCLEAR("unclear");

    private static final Map<String, TicketCategory> BY_WIRE_VALUE = Arrays.stream(values())
            .collect(Collectors.toMap(TicketCategory::getWireValue, Function.identity()));

    private final String wireValue;

    TicketCategory(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String getWireValue() {
        return wireValue;
    }

    @JsonCreator
    public static TicketCategory fromWireValue(String wireValue) {
        TicketCategory category = BY_WIRE_VALUE.get(wireValue);
        if (category == null) {
            throw new IllegalArgumentException("Unknown ticket category: " + wireValue);
        }
        return category;
    }
}
