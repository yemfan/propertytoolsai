/**
 * Pure invoice money math — subtotal, tax, total, line amounts, formatting.
 * No DB, no tenancy. The one genuinely shareable piece of bookkeeping logic
 * (smbai's accounting is double-entry + organization-scoped, so its ledger
 * code doesn't port; this flat AR math is the common ground).
 */

export type MoneyLine = { quantity: number; unitPrice: number };

/** Round to 2 decimals (cents), avoiding binary float drift. */
export function round2(n: number): number {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

/** Amount for a single line = quantity × unit price, to the cent. */
export function lineAmount(quantity: number, unitPrice: number): number {
  return round2((Number(quantity) || 0) * (Number(unitPrice) || 0));
}

/** Subtotal (sum of lines), tax (subtotal × rate), and total. */
export function computeTotals(
  lines: MoneyLine[],
  taxRate: number,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l.quantity, l.unitPrice), 0));
  const taxAmount = round2(subtotal * (Number(taxRate) || 0));
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}

/** Currency string, e.g. 1234.5 -> "$1,234.50". */
export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount) || 0);
  } catch {
    return `$${(Number(amount) || 0).toFixed(2)}`;
  }
}
