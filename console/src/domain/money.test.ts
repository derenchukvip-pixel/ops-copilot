import { describe, expect, it } from "vitest";
import { amountInWords, formatMoney, integerToWords, moneyAtStake } from "./money";

describe("moneyAtStake", () => {
  it("finds a positive numeric amount", () => {
    expect(moneyAtStake({ customerEmail: "a@b.example", amount: 249 })).toEqual({
      amount: 249,
      currency: "USD",
    });
  });

  it("returns null for actions that carry no amount", () => {
    expect(moneyAtStake({ customerEmail: "a@b.example", targetPlan: "pro" })).toBeNull();
  });

  it("returns null for a missing or empty parameter object", () => {
    expect(moneyAtStake(null)).toBeNull();
    expect(moneyAtStake(undefined)).toBeNull();
    expect(moneyAtStake({})).toBeNull();
  });

  /*
   * The parameters column is JSON written by an LLM extraction step. A string "249" is a
   * plausible thing to find there, and treating it as money would mean the confirmation
   * dialog reads an amount the arithmetic below cannot spell.
   */
  it("does not treat a numeric string as an amount", () => {
    expect(moneyAtStake({ amount: "249" })).toBeNull();
  });

  it("ignores zero, negative and non-finite amounts", () => {
    expect(moneyAtStake({ amount: 0 })).toBeNull();
    expect(moneyAtStake({ amount: -10 })).toBeNull();
    expect(moneyAtStake({ amount: Number.NaN })).toBeNull();
    expect(moneyAtStake({ amount: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe("formatMoney", () => {
  it("always shows two decimal places and a thousands separator", () => {
    expect(formatMoney({ amount: 1200, currency: "USD" })).toBe("$1,200.00");
    expect(formatMoney({ amount: 249, currency: "USD" })).toBe("$249.00");
    expect(formatMoney({ amount: 5, currency: "USD" })).toBe("$5.00");
  });
});

describe("integerToWords", () => {
  it("spells the boundaries of each range", () => {
    expect(integerToWords(0)).toBe("zero");
    expect(integerToWords(7)).toBe("seven");
    expect(integerToWords(13)).toBe("thirteen");
    expect(integerToWords(20)).toBe("twenty");
    expect(integerToWords(21)).toBe("twenty-one");
    expect(integerToWords(100)).toBe("one hundred");
    expect(integerToWords(101)).toBe("one hundred one");
    expect(integerToWords(999)).toBe("nine hundred ninety-nine");
    expect(integerToWords(1000)).toBe("one thousand");
    expect(integerToWords(1200)).toBe("one thousand two hundred");
    expect(integerToWords(5000)).toBe("five thousand");
    expect(integerToWords(1_000_000)).toBe("one million");
  });

  it("rejects values it cannot spell rather than returning something wrong", () => {
    expect(() => integerToWords(-1)).toThrow(RangeError);
    expect(() => integerToWords(1.5)).toThrow(RangeError);
    expect(() => integerToWords(1_000_000_000)).toThrow(RangeError);
  });
});

describe("amountInWords", () => {
  /*
   * The entire reason this function exists: these two amounts differ by one glyph as figures
   * and are unmistakable as words. If the agent extracted the wrong one from the ticket text,
   * the confirmation dialog is where a person catches it.
   */
  it("keeps look-alike amounts apart", () => {
    expect(amountInWords({ amount: 1200, currency: "USD" })).toBe(
      "one thousand two hundred US dollars",
    );
    expect(amountInWords({ amount: 120, currency: "USD" })).toBe("one hundred twenty US dollars");
  });

  it("spells cents only when there are any", () => {
    expect(amountInWords({ amount: 249, currency: "USD" })).toBe(
      "two hundred forty-nine US dollars",
    );
    expect(amountInWords({ amount: 249.5, currency: "USD" })).toBe(
      "two hundred forty-nine US dollars and fifty cents",
    );
    expect(amountInWords({ amount: 249.05, currency: "USD" })).toBe(
      "two hundred forty-nine US dollars and five cents",
    );
  });

  it("uses the singular for exactly one dollar or one cent", () => {
    expect(amountInWords({ amount: 1, currency: "USD" })).toBe("one US dollar");
    expect(amountInWords({ amount: 1.01, currency: "USD" })).toBe("one US dollar and one cent");
  });

  /* Floating point: 0.1 + 0.2 arithmetic upstream must not spell as "and zero cents" or crash. */
  it("rounds to cents before spelling", () => {
    expect(amountInWords({ amount: 10.004, currency: "USD" })).toBe("ten US dollars");
    expect(amountInWords({ amount: 10.005, currency: "USD" })).toBe(
      "ten US dollars and one cent",
    );
  });
});
