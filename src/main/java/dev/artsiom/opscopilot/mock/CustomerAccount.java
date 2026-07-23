package dev.artsiom.opscopilot.mock;

/**
 * A customer record in the mock billing/CRM system (out of scope per the spec: a real
 * integration is emulated behind a realistic contract, not built). Mutable because
 * change_subscription_plan actually mutates it — that's the point of the demo scenario.
 */
public class CustomerAccount {

    private final String email;
    private String plan;

    public CustomerAccount(String email, String plan) {
        this.email = email;
        this.plan = plan;
    }

    public String getEmail() {
        return email;
    }

    public String getPlan() {
        return plan;
    }

    public void setPlan(String plan) {
        this.plan = plan;
    }
}
