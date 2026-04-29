/**
 * Pure progress-vs-target math for LeadSmart AI Coaching.
 *
 * Two metrics the dashboard widget surfaces per program:
 *   - Transactions YTD vs annualTransactionTarget
 *   - Conversion rate (trailing 12mo) vs conversionRateTargetPct
 *
 * "On track" math is simple but worth gating in one place — the
 * widget needs a tone (green / amber / red) per metric, and we
 * want that decision consistent regardless of which program is
 * being rendered.
 *
 * Pure module — vitest hits it directly. The async fetcher in
 * `progress.server.ts` calls Supabase and feeds raw counts in.
 */

export type ProgressInput = {
  /** Closed transactions YTD. */
  transactionsYtd: number;
  /** Total contacts (any source) created in the trailing 12 months —
   *  the denominator for conversion rate. */
  contactsLast12Months: number;
  /** Distinct contacts (in the same 12-month window) that have at
   *  least one transaction with status='closed'. The numerator. */
  closedContactsLast12Months: number;
  /** Day of the year (1..366). Used to compute the on-track pace
   *  threshold so a January read isn't flagged "behind." */
  dayOfYear: number;
  /** Total days in the current year (365 or 366). */
  daysInYear: number;
};

export type ProgressTargets = {
  annualTransactionTarget: number;
  conversionRateTargetPct: number;
};

export type ProgressTone = "ahead" | "on_track" | "behind" | "no_data";

export type ProgressMetric = {
  /** Numeric value for display, e.g. 5 (transactions) or 2.4 (pct). */
  actual: number;
  /** Target value for display, e.g. 10 or 3. */
  target: number;
  /** "5 / 10" or "2.4% / 3.0%". */
  display: string;
  /** Pace tone — green ahead / blue on-track / amber behind / gray no-data. */
  tone: ProgressTone;
  /** 0..1 for the progress bar; clamped. */
  ratio: number;
};

export type ProgramProgress = {
  transactions: ProgressMetric;
  conversion: ProgressMetric;
};

export function computeProgress(
  input: ProgressInput,
  targets: ProgressTargets,
): ProgramProgress {
  const dayRatio =
    input.daysInYear > 0 ? Math.min(1, Math.max(0, input.dayOfYear / input.daysInYear)) : 0;

  // ── transactions ──────────────────────────────────────────────
  const txTarget = Math.max(0, targets.annualTransactionTarget);
  const txActual = Math.max(0, input.transactionsYtd);
  const txRatio = txTarget > 0 ? Math.min(1, txActual / txTarget) : 0;
  const txExpectedSoFar = txTarget * dayRatio;
  const txTone: ProgressTone =
    txTarget === 0
      ? "no_data"
      : txActual === 0 && dayRatio > 0.1
        ? "behind"
        : txActual >= txTarget
          ? "ahead"
          : txActual >= txExpectedSoFar * 0.85
            ? "on_track"
            : "behind";

  // ── conversion ────────────────────────────────────────────────
  const convTarget = Math.max(0, targets.conversionRateTargetPct);
  const denom = Math.max(0, input.contactsLast12Months);
  const numer = Math.max(0, input.closedContactsLast12Months);
  const convActual = denom > 0 ? (numer / denom) * 100 : 0;
  const convRatio = convTarget > 0 ? Math.min(1, convActual / convTarget) : 0;
  const convTone: ProgressTone =
    denom === 0
      ? "no_data"
      : convActual >= convTarget
        ? "ahead"
        : convActual >= convTarget * 0.7
          ? "on_track"
          : "behind";

  return {
    transactions: {
      actual: txActual,
      target: txTarget,
      display: `${txActual} / ${txTarget}`,
      tone: txTone,
      ratio: txRatio,
    },
    conversion: {
      actual: roundOneDecimal(convActual),
      target: convTarget,
      display: `${roundOneDecimal(convActual)}% / ${convTarget}%`,
      tone: convTone,
      ratio: convRatio,
    },
  };
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function getDaysInYear(year: number): number {
  // Leap year: divisible by 4, not 100 unless 400.
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

function roundOneDecimal(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}
