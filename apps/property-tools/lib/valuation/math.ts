export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function roundMoney(value: number) {
  return Math.round(value);
}

export function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function pctDiff(a: number, b: number) {
  if (!a || !b) return 0;
  return Math.abs(a - b) / ((a + b) / 2);
}
