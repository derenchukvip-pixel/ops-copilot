import type { JsonObject } from "@/api/types";

/**
 * `IssueRefundTool`'s schema documents `amount` as "Refund amount in USD" and the backend
 * carries no currency field, so there is nothing to read here — writing USD is reporting the
 * contract, not guessing at it. If the backend ever gains a currency, this is the one place
 * that has to change.
 */
export const CURRENCY_CODE = "USD";

export interface MoneyAtStake {
  amount: number;
  currency: string;
}

/**
 * Whether approving this action moves money, and how much.
 *
 * Keyed on the shape of the parameters rather than on the tool name: any tool carrying a
 * positive numeric `amount` is a tool that spends something, and a new one added to the Java
 * side should get the extra confirmation step without anyone remembering to update a list here.
 */
export function moneyAtStake(parameters: JsonObject | null | undefined): MoneyAtStake | null {
  const amount = parameters?.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return { amount, currency: CURRENCY_CODE };
}

/** `249` → `"$249.00"`. Uses the same formatting everywhere a figure is shown. */
export function formatMoney({ amount, currency }: MoneyAtStake): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** Spells a non-negative integer below one billion. */
export function integerToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Expected a non-negative integer, got ${value}`);
  }
  if (value >= 1_000_000_000) {
    throw new RangeError(`Value out of range for spelling: ${value}`);
  }

  if (value < 20) {
    return ONES[value];
  }
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const ones = value % 10;
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
  }
  if (value < 1000) {
    const hundreds = `${ONES[Math.floor(value / 100)]} hundred`;
    const rest = value % 100;
    return rest === 0 ? hundreds : `${hundreds} ${integerToWords(rest)}`;
  }
  if (value < 1_000_000) {
    const thousands = `${integerToWords(Math.floor(value / 1000))} thousand`;
    const rest = value % 1000;
    return rest === 0 ? thousands : `${thousands} ${integerToWords(rest)}`;
  }

  const millions = `${integerToWords(Math.floor(value / 1_000_000))} million`;
  const rest = value % 1_000_000;
  return rest === 0 ? millions : `${millions} ${integerToWords(rest)}`;
}

/**
 * Spells an amount out in full, for the confirmation step before a refund executes.
 *
 * The figure and the words are two independent readings of the same number, which is the whole
 * point: `$1,200.00` and `$120.00` differ by one glyph and are easy to skim past, while "one
 * thousand two hundred" and "one hundred twenty" are not. This is the last thing between a
 * misread parameter and a real payout.
 */
export function amountInWords({ amount }: MoneyAtStake): string {
  // Round to cents first, so 0.005 does not spell as zero-and-zero.
  const totalCents = Math.round(amount * 100);
  const units = Math.floor(totalCents / 100);
  const cents = totalCents % 100;

  const unitWords = `${integerToWords(units)} US ${units === 1 ? "dollar" : "dollars"}`;

  if (cents === 0) {
    return unitWords;
  }
  return `${unitWords} and ${integerToWords(cents)} ${cents === 1 ? "cent" : "cents"}`;
}
