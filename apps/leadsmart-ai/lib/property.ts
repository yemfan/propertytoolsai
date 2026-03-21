export type HomeValueEstimate = {
  value: number;
  low: number;
  high: number;
  displayValue: string;
  displayLow: string;
  displayHigh: string;
};

// Simple deterministic, front-end-safe estimator used only for preview UI.
export function estimateHomeValue(address: string): HomeValueEstimate {
  const hash = Array.from(address)
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 500_000;
  const base = 500_000 + hash;
  const value = Math.round(base / 1000) * 1000;
  const low = Math.round(value * 0.92);
  const high = Math.round(value * 1.08);

  const fmt = (n: number) => `$${n.toLocaleString()}`;

  return {
    value,
    low,
    high,
    displayValue: fmt(value),
    displayLow: fmt(low),
    displayHigh: fmt(high),
  };
}

