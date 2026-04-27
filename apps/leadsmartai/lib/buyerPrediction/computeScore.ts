import {
  BUYER_PREDICTION_THRESHOLDS,
  BUYER_PREDICTION_WEIGHTS,
  type BuyerPredictionFactor,
  type BuyerPredictionInput,
  type BuyerPredictionLabel,
  type BuyerPredictionScoreResult,
} from "@/lib/buyerPrediction/types";

const DAY_MS = 86_400_000;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function roundScore(n: number): number {
  return clamp(Math.round(n), 0, 100);
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / DAY_MS;
}

function yearsSince(iso: string | null | undefined): number | null {
  const d = daysSince(iso);
  return d == null ? null : d / 365.25;
}

function labelForScore(score: number): BuyerPredictionLabel {
  if (score >= BUYER_PREDICTION_THRESHOLDS.highMin) return "high";
  if (score >= BUYER_PREDICTION_THRESHOLDS.mediumMin) return "medium";
  return "low";
}

/**
 * Tenure (years owned). Same bell curve as sphere-prediction (sell-then-buy
 * concurrent move pattern), but with a lower max contribution since tenure
 * alone is a weaker buyer signal than the explicit intent signals below.
 *
 *   <1y:    just bought, very unlikely to buy again — 0 pts
 *   1–2y:   too soon — 5 pts
 *   2–4y:   warming up — 13 pts
 *   4–9y:   peak move-up window — full 25 pts
 *   9–13y:  second common move window — 18 pts
 *   13–20y: longer tenure — 11 pts
 *   >20y:   very long tenure — 6 pts
 */
function scoreTenure(homePurchaseDate: string | null): { earned: number; detail: string } {
  const max = BUYER_PREDICTION_WEIGHTS.tenure;
  const years = yearsSince(homePurchaseDate);
  if (years == null) {
    return { earned: 6, detail: "Closing date unknown — neutral baseline." };
  }
  const y = years.toFixed(1);
  if (years < 1) return { earned: 0, detail: `Owned ~${y}y — just settled in, unlikely to buy again.` };
  if (years < 2) return { earned: 5, detail: `Owned ~${y}y — too soon for a next move.` };
  if (years < 4) return { earned: 13, detail: `Owned ~${y}y — entering common move-up window.` };
  if (years < 9) return { earned: max, detail: `Owned ~${y}y — peak move-up window.` };
  if (years < 13) return { earned: 18, detail: `Owned ~${y}y — second move-up window.` };
  if (years < 20) return { earned: 11, detail: `Owned ~${y}y — longer tenure, somewhat less mobile.` };
  return { earned: 6, detail: `Owned ~${y}y — long tenure, lower likelihood.` };
}

/**
 * Buyer-intent signals. The signal weights here DIFFER from sphere-prediction:
 *
 *   job_change         24 (highest — relocation = must-buy)
 *   life_event_other   20 (marriage/kids/divorce/retirement → buy or downsize)
 *   equity_milestone   14 (could afford to upgrade)
 *   refi_detected      12 (cash-out refis often precede a move-up)
 *   anniversary_due     6 (low — anniversary is a touch-point, not intent)
 *   listing_activity    0 (seller-only signal — neighbors selling doesn't
 *                          predict buying)
 *
 * Confidence multiplier same as sphere: high=1.0, medium=0.8, low=0.55.
 *
 * Take the strongest single signal (no compounding) — same anti-false-
 * positive rule as sphere.
 */
function scoreBuyerIntentSignals(input: BuyerPredictionInput): {
  earned: number;
  detail: string;
} {
  const max = BUYER_PREDICTION_WEIGHTS.buyer_intent_signals;
  const open = input.openSignals;
  if (!open || open.length === 0) {
    return { earned: 0, detail: "No open buyer-intent signals." };
  }

  const TYPE_POINTS: Record<string, number> = {
    job_change: 24,
    life_event_other: 20,
    equity_milestone: 14,
    refi_detected: 12,
    anniversary_due: 6,
    listing_activity: 0, // explicitly excluded — seller signal only
  };

  let bestPoints = 0;
  let bestType: string | null = null;
  let bestConfidence: string | null = null;
  for (const sig of open) {
    const base = TYPE_POINTS[sig.type] ?? 8;
    if (base === 0) continue;
    const mult = sig.confidence === "high" ? 1 : sig.confidence === "medium" ? 0.8 : 0.55;
    const pts = base * mult;
    if (pts > bestPoints) {
      bestPoints = pts;
      bestType = sig.type;
      bestConfidence = sig.confidence;
    }
  }

  const earned = clamp(Math.round(bestPoints), 0, max);
  if (earned === 0) {
    return { earned: 0, detail: "Open signals present but none predict buying." };
  }
  const others = open.length > 1 ? ` (+${open.length - 1} other)` : "";
  return {
    earned,
    detail: `Strongest buyer signal: ${bestType?.replace(/_/g, " ") ?? "unknown"} (${bestConfidence ?? "?"})${others}.`,
  };
}

/**
 * Equity-to-upgrade. Different framing from sphere's "equity_gain":
 *
 *   sphere asks: "did the home appreciate enough to motivate selling?"
 *   buyer asks:  "do they have enough equity to afford a bigger / next home?"
 *
 * Both look at the same numbers (closing_price → avm_current) but the
 * buyer-side score caps lower because equity alone doesn't predict buying —
 * it's a permission slip, not an intent signal.
 */
function scoreEquityToUpgrade(input: BuyerPredictionInput): {
  earned: number;
  detail: string;
} {
  const max = BUYER_PREDICTION_WEIGHTS.equity_to_upgrade;
  const { closingPrice, avmCurrent, avmUpdatedAt } = input;
  if (!closingPrice || !avmCurrent || closingPrice <= 0 || avmCurrent <= 0) {
    return { earned: 5, detail: "Equity unknown — neutral baseline." };
  }
  const deltaDollars = avmCurrent - closingPrice;
  const deltaPct = deltaDollars / closingPrice;

  const avmAgeDays = daysSince(avmUpdatedAt);
  const stalenessFactor =
    avmAgeDays == null
      ? 0.7
      : avmAgeDays <= 30
        ? 1
        : avmAgeDays <= 90
          ? 0.85
          : avmAgeDays <= 365
            ? 0.7
            : 0.5;

  let raw = 0;
  if (deltaPct >= 0.5 || deltaDollars >= 300_000) raw = max;
  else if (deltaPct >= 0.3 || deltaDollars >= 175_000) raw = 15;
  else if (deltaPct >= 0.15 || deltaDollars >= 75_000) raw = 9;
  else if (deltaPct >= 0) raw = 4;
  else raw = 0;

  const earned = clamp(Math.round(raw * stalenessFactor), 0, max);
  const dollarsStr = `$${Math.round(deltaDollars).toLocaleString()}`;
  const pctStr = `${(deltaPct * 100).toFixed(0)}%`;
  const stale =
    stalenessFactor < 1 ? ` (AVM age ${avmAgeDays?.toFixed(0) ?? "?"}d — discounted)` : "";
  return {
    earned,
    detail: `Equity available for upgrade: ${dollarsStr} (${pctStr})${stale}.`,
  };
}

/**
 * Engagement uptick. Same logic as sphere — recent activity + non-trivial
 * engagement score = "thinking about it." Bidirectional indicator.
 */
function scoreEngagementUptick(input: BuyerPredictionInput): {
  earned: number;
  detail: string;
} {
  const max = BUYER_PREDICTION_WEIGHTS.engagement_uptick;
  const eng = clamp(input.engagementScore ?? 0, 0, 200);
  const lastAct = daysSince(input.lastActivityAt);

  if (lastAct == null) {
    return { earned: 0, detail: "No recent activity to evaluate." };
  }

  let raw = 0;
  if (lastAct <= 7 && eng >= 60) raw = max;
  else if (lastAct <= 7 && eng >= 30) raw = 11;
  else if (lastAct <= 14 && eng >= 30) raw = 8;
  else if (lastAct <= 30 && eng >= 30) raw = 5;
  else if (lastAct <= 30) raw = 2;

  const earned = clamp(Math.round(raw), 0, max);
  return {
    earned,
    detail: `Engagement ${Math.round(eng)} · last activity ${lastAct.toFixed(0)}d ago.`,
  };
}

/**
 * Anniversary / dormancy reactivation. Same logic as sphere — a 5/7/10y
 * anniversary is the agent's classic re-engagement moment, regardless of
 * sell-vs-buy direction.
 */
function scoreAnniversaryDormancy(input: BuyerPredictionInput): {
  earned: number;
  detail: string;
} {
  const max = BUYER_PREDICTION_WEIGHTS.anniversary_dormancy;
  const years = yearsSince(input.homePurchaseDate);
  let raw = 0;
  const reasons: string[] = [];

  if (years != null) {
    const daysFromNearestAnniversary = Math.abs(Math.round(years) - years) * 365.25;
    if (daysFromNearestAnniversary <= 30 && years >= 1) {
      const yr = Math.round(years);
      if (yr === 5 || yr === 7 || yr === 10) {
        raw += 8;
        reasons.push(`${yr}-year anniversary (high-value moment)`);
      } else if (yr === 3 || yr === 13 || yr === 15) {
        raw += 5;
        reasons.push(`${yr}-year anniversary`);
      } else {
        raw += 3;
        reasons.push(`${yr}-year anniversary nearby`);
      }
    }
  }

  const sinceContact = daysSince(input.lastContactedAt);
  const sinceAct = daysSince(input.lastActivityAt);
  if (sinceContact != null && sinceContact >= 180 && sinceAct != null && sinceAct <= 14) {
    raw += 4;
    reasons.push("re-emerging from long dormancy");
  }

  const earned = clamp(Math.round(raw), 0, max);
  return {
    earned,
    detail:
      reasons.length === 0
        ? "No anniversary or dormancy reactivation signal."
        : reasons.join("; ") + ".",
  };
}

/**
 * Compute the buyer-likelihood score. Pure function — Date.now() is the
 * only side-effect; tests pin it via `vi.useFakeTimers`.
 */
export function computeBuyerPrediction(
  input: BuyerPredictionInput,
): BuyerPredictionScoreResult {
  const factors: BuyerPredictionFactor[] = [];

  const t = scoreTenure(input.homePurchaseDate);
  factors.push({
    id: "tenure",
    label: "Tenure (years owned)",
    pointsEarned: t.earned,
    pointsMax: BUYER_PREDICTION_WEIGHTS.tenure,
    detail: t.detail,
  });

  const s = scoreBuyerIntentSignals(input);
  factors.push({
    id: "buyer_intent_signals",
    label: "Buyer-intent signals",
    pointsEarned: s.earned,
    pointsMax: BUYER_PREDICTION_WEIGHTS.buyer_intent_signals,
    detail: s.detail,
  });

  const e = scoreEquityToUpgrade(input);
  factors.push({
    id: "equity_to_upgrade",
    label: "Equity to upgrade",
    pointsEarned: e.earned,
    pointsMax: BUYER_PREDICTION_WEIGHTS.equity_to_upgrade,
    detail: e.detail,
  });

  const u = scoreEngagementUptick(input);
  factors.push({
    id: "engagement_uptick",
    label: "Engagement uptick",
    pointsEarned: u.earned,
    pointsMax: BUYER_PREDICTION_WEIGHTS.engagement_uptick,
    detail: u.detail,
  });

  const a = scoreAnniversaryDormancy(input);
  factors.push({
    id: "anniversary_dormancy",
    label: "Anniversary / dormancy reactivation",
    pointsEarned: a.earned,
    pointsMax: BUYER_PREDICTION_WEIGHTS.anniversary_dormancy,
    detail: a.detail,
  });

  const score = roundScore(factors.reduce((sum, f) => sum + f.pointsEarned, 0));
  return { score, label: labelForScore(score), factors };
}
