package dev.artsiom.opscopilot.mock;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mock CRM/billing backend (explicitly out of scope to build for real — section 4 of the spec).
 * Behind a realistic contract: callers get back the same shapes a real Stripe/CRM integration
 * would return, just backed by an in-memory map instead of a network call.
 */
@Service
public class MockBillingService {

    private final Map<String, CustomerAccount> accounts = new ConcurrentHashMap<>();

    public MockBillingService() {
        accounts.put("alice@acme.io", new CustomerAccount("alice@acme.io", "starter"));
        accounts.put("bob@acme.io", new CustomerAccount("bob@acme.io", "pro"));
    }

    public CustomerAccount getOrCreateAccount(String email) {
        return accounts.computeIfAbsent(email, e -> new CustomerAccount(e, "starter"));
    }

    public PasswordResetLink generateResetLink(String email) {
        getOrCreateAccount(email);
        String token = UUID.randomUUID().toString();
        return new PasswordResetLink(token, "https://app.example.com/reset-password?token=" + token,
                Instant.now().plus(1, ChronoUnit.HOURS));
    }

    public Invoice getLatestInvoice(String email) {
        getOrCreateAccount(email);
        String invoiceId = "INV-" + Math.abs(email.hashCode() % 100000);
        return new Invoice(invoiceId, new BigDecimal("49.00"), "USD",
                Instant.now().minus(3, ChronoUnit.DAYS),
                "https://app.example.com/invoices/" + invoiceId + ".pdf");
    }

    public CustomerAccount changePlan(String email, String newPlan) {
        CustomerAccount account = getOrCreateAccount(email);
        account.setPlan(newPlan);
        return account;
    }

    public RefundResult issueRefund(String email, BigDecimal amount, String reason) {
        getOrCreateAccount(email);
        return new RefundResult("RF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                amount, "PROCESSED");
    }
}
