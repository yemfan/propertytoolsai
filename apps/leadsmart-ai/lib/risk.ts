export type RiskLevel = "low" | "medium" | "high";

export type RiskPillar = {
  level: RiskLevel;
  /** 0 = best, 100 = worst */
  score: number;
  notes: string;
};

export type DealRiskInput = {
  listPrice: number;
  recommendedOffer: number;
  comparablesMedian?: number;
  daysOnMarket: number;
  marketHeat: "hot" | "balanced" | "cool";
};

export type DealRiskAssessment = {
  overpay: RiskPillar;
  appraisal: RiskPillar;
  market: RiskPillar;
};

function levelFromScore(score: number): RiskLevel {
  if (score < 36) return "low";
  if (score < 66) return "medium";
  return "high";
}

/**
 * Risk analyzer — deterministic scoring from deal structure + market context.
 */
export function analyzeDealRisks(input: DealRiskInput): DealRiskAssessment {
  const list = Math.max(1, input.listPrice);
  const offer = Math.max(0, input.recommendedOffer);
  const comps = input.comparablesMedian;

  // Overpay: offer vs comps / list
  let overpayScore = 40;
  if (comps && comps > 0) {
    const vsComps = offer / comps;
    if (vsComps > 1.08) overpayScore += 35;
    else if (vsComps > 1.03) overpayScore += 20;
    else if (vsComps < 0.97) overpayScore -= 15;
  } else {
    overpayScore += 12;
  }
  const vsList = offer / list;
  if (vsList > 1) overpayScore += 15;
  overpayScore = Math.max(8, Math.min(92, Math.round(overpayScore)));

  // Appraisal gap risk: offer materially above comps
  let appraisalScore = 35;
  if (comps && comps > 0) {
    const gap = (offer - comps) / comps;
    if (gap > 0.06) appraisalScore += 40;
    else if (gap > 0.03) appraisalScore += 22;
    else if (gap < -0.02) appraisalScore -= 10;
  } else {
    appraisalScore += 18;
  }
  if (input.marketHeat === "hot") appraisalScore += 5;
  appraisalScore = Math.max(10, Math.min(90, Math.round(appraisalScore)));

  // Market / liquidity risk
  let marketScore = 38;
  if (input.marketHeat === "cool") marketScore += 18;
  if (input.marketHeat === "hot") marketScore -= 12;
  if (input.daysOnMarket > 90) marketScore += 20;
  else if (input.daysOnMarket > 45) marketScore += 10;
  else if (input.daysOnMarket < 10) marketScore -= 8;
  marketScore = Math.max(12, Math.min(88, Math.round(marketScore)));

  const overpay: RiskPillar = {
    level: levelFromScore(overpayScore),
    score: overpayScore,
    notes:
      comps && comps > 0
        ? `Offer is ${((offer / comps) * 100).toFixed(1)}% of stated comp median — ${overpayScore >= 60 ? "materially above typical support" : "roughly in line with comps if condition matches"}.`
        : "Without a comp median, overpay risk is directional only — pull 3–5 closed sales before tightening.",
  };

  const appraisal: RiskPillar = {
    level: levelFromScore(appraisalScore),
    score: appraisalScore,
    notes:
      comps && comps > 0
        ? appraisalScore >= 58
          ? "Appraisal below offer could force renegotiation or extra cash — plan appraisal gap language early."
          : "Appraisal risk looks moderate if condition and quality match comp set."
        : "Add closed comps to stress-test appraised value vs. offer.",
  };

  const market: RiskPillar = {
    level: levelFromScore(marketScore),
    score: marketScore,
    notes:
      input.marketHeat === "cool" && input.daysOnMarket > 60
        ? "Slower demand + higher DOM — stronger buyer leverage on price and concessions."
        : input.marketHeat === "hot"
          ? "Competitive demand — speed and clean terms may outweigh small price differences."
          : "Balanced market — win on terms + credible financing as much as headline price.",
  };

  return { overpay, appraisal, market };
}
