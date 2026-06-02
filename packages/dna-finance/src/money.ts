// Pure invoice/estimate money math. No I/O, no framework — trivially testable.

export interface LineLike {
  amount: number;
}

export interface DocTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** Sum line amounts, apply a tax rate, round to cents. */
export function computeTotals(lines: LineLike[], taxRate: number): DocTotals {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxAmount = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + taxAmount).toFixed(2);
  return { subtotal, taxAmount, total };
}

/** Sequential document number, e.g. formatDocNumber("INV", 7) -> "INV-0007". */
export function formatDocNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
