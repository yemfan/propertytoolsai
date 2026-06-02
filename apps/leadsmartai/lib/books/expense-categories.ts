/**
 * Realtor business-expense categories — the tax-relevant buckets a real estate
 * agent actually spends in. Plain module (no "server-only") so the web client
 * UI, the mobile app, and the server service can all share one source of truth.
 */

export const EXPENSE_CATEGORIES = [
  "Marketing & Advertising",
  "Auto & Mileage",
  "Dues & Subscriptions",
  "Signage & Printing",
  "Staging",
  "Client Gifts & Meals",
  "Office & Software",
  "Education & CE",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Coerce arbitrary input to a known category (defaults to "Other"). */
export function normalizeCategory(value: unknown): ExpenseCategory {
  const s = String(value ?? "").trim().toLowerCase();
  return EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === s) ?? "Other";
}
