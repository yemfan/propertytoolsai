import {
  SPHERE_SELLER_THRESHOLDS,
  SPHERE_SELLER_WEIGHTS,
  type SphereSellerFactor,
  type SphereSellerInput,
  type SphereSellerLabel,
  type SphereSellerScoreResult,
} from "@/lib/spherePrediction/types";

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

function labelForScore(score: number): SphereSellerLabel {
  if (score >= SPHERE_SELLER_THRESHOLDS.highMin) return "high";
  if (score >= SPHERE_SELLER_THRESHOLDS.mediumMin) return "medium";
  return "low";
}

/**
 * Tenure (years owned). Bell curve around the typical 5–9-year sell cycle.
 * Realtors call this the "average homeowner moves every 7 years" rule.
 *
 *   <1y:    very unlikely to sell — 0 pts
 *   1–2y:   too soon — 6 pts
 *   2–4y:   warming up — 16 pts
 *   4–9y:   peak sell window — full 30 pts
 *   9–13y:  still common — 22 pts
 *   13–20y: long tenure, less mobile — 14 pts
 *   >20y:   long-tenured (often seniors) — 8 pts
 */
function scoreTenure(homePurchaseDate: string | null): { earned: number; detail: string } {
  const max = SPHERE_SELLER_WEIGHTS.tenure;
  const years = yearsSince(homePurchaseDate);
  if (years == null) {
    return { earned: 8, detail: "Closing date unknown — neutral baseline." };
  }
  const y = years.toFixed(1);
  if (years < 1) return { earned: 0, detail: `Owned ~${y}y — too recent to sell.` };
  if (years < 2) return { earned: 6, detail: `Owned ~${y}y — early ownership, low likelihood.` };
  if (years < 4) return { earned: 16, detail: `Owned ~${y}y — entering common move window.` };
  if (years < 9) return { earned: max, detail: `Owned ~${y}y — peak sell window.` };
  if (years < 13) return { earned: 22, detail: `Owned ~${y}y — second common move window.` };
  if (years < 20) return { earned: 14, detail: `Owned ~${y}y — longer tenure, somewhat less mobile.` };
  return { earned: 8, detail: `Owned ~${y}y — long tenure, lower likelihood.` };
}

/**
 * Equity gain. Two complementary signals — absolute dollars and percentage.
 * Both matter: a 30% gain on a $300K house ($90K) is psychologically
 * different from a 30% gain on a $1.5M house ($450K), even though the % is
 * identical.
 */
function scoreEquity(input: SphereSellerInput): { earned: number; detail: string } {
  const max = SPHERE_SELLER_WEIGHTS.equity_gain;
  const { closingPrice, avmCurrent, avmUpdatedAt } = input;
  if (!closingPrice || !avmCurrent || closingPrice <= 0 || avmCurrent <= 0) {
    return {
      earned: 6,
      detail: "Equity unknown (no closing price or AVM) — neutral baseline.",
    };
  }
  const deltaDollars = avmCurrent - closingPrice;
  const deltaPct = deltaDollars / closingPrice;

  // Stale AVM cuts the signal — a 2-year-old number is noise in fast markets.
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

  // Score the better of the two signals (dollars or pct), then apply staleness.
  let raw = 0;
  if (deltaPct >= 0.6 || deltaDollars >= 400_000) raw = max;
  else if (deltaPct >= 0.4 || deltaDollars >= 250_000) raw = 20;
  else if (deltaPct >= 0.25 || deltaDollars >= 150_000) raw = 14;
  else if (deltaPct >= 0.1 || deltaDollars >= 60_000) raw = 8;
  else if (deltaPct >= 0) raw = 4;
  else raw = 0;

  const earned = clamp(Math.round(raw * stalenessFactor), 0, max);
  const dollarsStr = `$${Math.round(deltaDollars).toLocaleString()}`;
  const pctStr = `${(deltaPct * 100).toFixed(0)}%`;
  const stale =
    stalenessFactor < 1 ? ` (AVM age ${avmAgeDays?.toFixed(0) ?? "?"}d — discounted)` : "";
  return {
    earned,
    detail: `Equity ${dollarsStr} (${pctStr}) since closing${stale}.`,
  };
}

/**
 * Open contact signals. The contact-signal pipeline already detects life
 * events (job change, refi, equity milestones, listing activity). When one or
 * more are open and unacknowledged, that is *the* highest-quality seller
 * intent we ever get — third-party-detected, time-bounded, agent-actionable.
 *
 * Confidence tiers translate into a multiplier so a "low" auto-detected
 * signal does not weigh as heavily as a "high" one (which usually means
 * a human or external feed corroborated it).
 */
function scoreOpenSignals(input: SphereSellerInput): { earned: number; detail: string } {
  const max = SPHERE_SELLER_WEIGHTS.open_signals;
  const open = input.openSignals;
  if (!open || open.length === 0) {
    return { earned: 0, detail: "No open seller-intent signals." };
  }

  // Per-type point ceilings. listing_activity (a comparable nearby just
  // listed) and equity_milestone are the strongest because they are the
  // most behaviorally predictive in industry research.
  const TYPE_POINTS: Record<string, number> = {
    listing_activity: 20,
    equity_milestone: 18,
    refi_detected: 14,
    job_change: 12,
    life_event_other: 10,
    anniversary_due: 6,
  };

  // Take the strongest signal (don't compound — multiple weak signals should
  // not outscore one strong signal; compound risk = false positives).
  let bestPoints = 0;
  let bestType: string | null = null;
  let bestConfidence: string | null = null;
  for (const sig of open) {
    const base = TYPE_POINTS[sig.type] ?? 8;
    const mult = sig.confidence === "high" ? 1 : sig.confidence === "medium" ? 0.8 : 0.55;
    const pts = base * mult;
    if (pts > bestPoints) {
      bestPoints = pts;
      bestType = sig.type;
      bestConfidence = sig.confidence;
    }
  }

  const earned = clamp(Math.round(bestPoints), 0, max);
  const others = open.length > 1 ? ` (+${open.length - 1} other)` : "";
  return {
    earned,
    detail: `Strongest open signal: ${bestType?.replace(/_/g, " ") ?? "unknown"} (${bestConfidence ?? "?"})${others}.`,
  };
}

/**
 * Engagement uptick. A previously-quiet past_client who suddenly opened the
 * last few emails is "thinking about it." We approximate this with the
 * engagementScore baseline and the recency of activity vs contact.
 *
 * Without the historical baseline we just reward (recent activity AND a
 * non-trivial engagement score). It's a softer signal than tenure / equity
 * but adds useful lift.
 */
function scoreEngagementUptick(input: SphereSellerInput): { earned: number; detail: string } {
  const max = SPHERE_SELLER_WEIGHTS.engagement_uptick;
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
 * Anniversary / dormancy reactivation. Hitting a closing-date anniversary
 * (especially 5y / 7y / 10y) is the classic SOI farming moment. Also gives
 * a small bump for re-emerging-from-dormancy contacts (a past_client who
 * went quiet for >180d and just popped back up).
 */
function scoreAnniversaryDormancy(input: SphereSellerInput): { earned: number; detail: string } {
  const max = SPHERE_SELLER_WEIGHTS.anniversary_dormancy;
  const years = yearsSince(input.homePurchaseDate);
  let raw = 0;
  const reasons: string[] = [];

  if (years != null) {
    // Within 30 days of an integer anniversary
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

  // Re-emerging from dormancy: long gap since last contact, but recent activity.
  const sinceContact = daysSince(input.lastContactedAt);
  const sinceAct = daysSince(input.lastActivityAt);
  if (sinceContact != null && sinceContact >= 180 && sinceAct != null && sinceAct <= 14) {
    raw += 4;
    reasons.push("re-emerging from long dormancy");
  }

  const earned = clamp(Math.round(raw), 0, max);
  return {
    earned,
    detail: reasons.length === 0 ? "No anniversary or dormancy reactivation signal." : reasons.join("; ") + ".",
  };
}

/**
 * Compute the seller-likelihood score. Pure function — no I/O, no clocks
 * other than `Date.now()`. Tests mock `Date.now()` for determinism.
 */
export function computeSphereSellerPrediction(
  input: SphereSellerInput,
): SphereSellerScoreResult {
  const factors: SphereSellerFactor[] = [];

  const t = scoreTenure(input.homePurchaseDate);
  factors.push({
    id: "tenure",
    label: "Tenure (years owned)",
    pointsEarned: t.earned,
    pointsMax: SPHERE_SELLER_WEIGHTS.tenure,
    detail: t.detail,
  });

  const e = scoreEquity(input);
  factors.push({
    id: "equity_gain",
    label: "Equity gain",
    pointsEarned: e.earned,
    pointsMax: SPHERE_SELLER_WEIGHTS.equity_gain,
    detail: e.detail,
  });

  const s = scoreOpenSignals(input);
  factors.push({
    id: "open_signals",
    label: "Open intent signals",
    pointsEarned: s.earned,
    pointsMax: SPHERE_SELLER_WEIGHTS.open_signals,
    detail: s.detail,
  });

  const u = scoreEngagementUptick(input);
  factors.push({
    id: "engagement_uptick",
    label: "Engagement uptick",
    pointsEarned: u.earned,
    pointsMax: SPHERE_SELLER_WEIGHTS.engagement_uptick,
    detail: u.detail,
  });

  const a = scoreAnniversaryDormancy(input);
  factors.push({
    id: "anniversary_dormancy",
    label: "Anniversary / dormancy reactivation",
    pointsEarned: a.earned,
    pointsMax: SPHERE_SELLER_WEIGHTS.anniversary_dormancy,
    detail: a.detail,
  });

  const score = roundScore(factors.reduce((sum, f) => sum + f.pointsEarned, 0));
  return { score, label: labelForScore(score), factors };
}
