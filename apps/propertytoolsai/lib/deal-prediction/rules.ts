import type { LeadPredictionFeatures, LeadPredictionResult, PredictionFactor } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addFactor(
  factors: PredictionFactor[],
  label: string,
  impact: "positive" | "negative" | "neutral",
  weight: number,
  reason: string
) {
  factors.push({ label, impact, weight, reason });
}

function estimateDealValue(features: LeadPredictionFeatures) {
  if (features.pricePoint > 0) {
    return Math.round(features.pricePoint * 0.025);
  }

  switch (features.source) {
    case "listing_inquiry":
      return 18000;
    case "smart_property_match":
      return 16000;
    case "affordability_report":
      return 14000;
    case "home_value_estimate":
      return 20000;
    default:
      return 12000;
  }
}

function estimateCloseWindow(
  probability: number,
  features: LeadPredictionFeatures
): LeadPredictionResult["predictedCloseWindow"] {
  if (features.hasTourRequest || features.hasAppointmentSignal || probability >= 85) return "0-7 days";
  if (probability >= 65) return "8-30 days";
  if (probability >= 40) return "31-90 days";
  return "90+ days";
}

export function predictLeadClose(features: LeadPredictionFeatures): LeadPredictionResult {
  let probability = 10;
  const factors: PredictionFactor[] = [];

  if (features.source === "listing_inquiry") {
    probability += 20;
    addFactor(
      factors,
      "Listing inquiry source",
      "positive",
      20,
      "Direct property interest usually converts better than generic traffic."
    );
  } else if (features.source === "smart_property_match") {
    probability += 18;
    addFactor(
      factors,
      "Smart Match source",
      "positive",
      18,
      "Personalized search engagement is a strong buyer-intent signal."
    );
  } else if (features.source === "affordability_report") {
    probability += 12;
    addFactor(
      factors,
      "Affordability source",
      "positive",
      12,
      "Budget-aware leads are often earlier but still meaningful."
    );
  } else if (features.source === "home_value_estimate") {
    probability += 14;
    addFactor(
      factors,
      "Home value source",
      "positive",
      14,
      "Seller interest can convert well with proper follow-up."
    );
  }

  if (features.leadScore >= 80) {
    probability += 22;
    addFactor(factors, "High lead score", "positive", 22, "Multiple engagement signals indicate strong intent.");
  } else if (features.leadScore >= 60) {
    probability += 14;
    addFactor(factors, "Good lead score", "positive", 14, "The lead has above-average engagement.");
  } else if (features.leadScore < 30) {
    probability -= 10;
    addFactor(factors, "Low lead score", "negative", 10, "Weak engagement lowers short-term close probability.");
  }

  if (features.hasReplyFromLead) {
    probability += 16;
    addFactor(factors, "Lead replied", "positive", 16, "Two-way conversation strongly increases conversion odds.");
  }

  if (features.inboundMessageCount >= 3) {
    probability += 12;
    addFactor(factors, "Active conversation", "positive", 12, "Several inbound replies suggest active interest.");
  }

  if (features.outboundMessageCount === 0) {
    probability -= 8;
    addFactor(factors, "No outbound follow-up yet", "negative", 8, "Lack of response lowers momentum.");
  }

  if (features.hasTourRequest) {
    probability += 25;
    addFactor(factors, "Tour request", "positive", 25, "Tour requests are among the strongest pre-close signals.");
  }

  if (features.hasAppointmentSignal) {
    probability += 18;
    addFactor(
      factors,
      "Appointment signal",
      "positive",
      18,
      "A scheduled call or appointment indicates forward movement."
    );
  }

  if (typeof features.avgResponseMinutes === "number") {
    if (features.avgResponseMinutes <= 5) {
      probability += 10;
      addFactor(factors, "Fast response time", "positive", 10, "Fast follow-up significantly improves conversion.");
    } else if (features.avgResponseMinutes > 60) {
      probability -= 8;
      addFactor(factors, "Slow response time", "negative", 8, "Slow response time reduces close probability.");
    }
  }

  if (typeof features.hoursSinceLastActivity === "number") {
    if (features.hoursSinceLastActivity <= 24) {
      probability += 10;
      addFactor(factors, "Recent activity", "positive", 10, "Recent activity means the lead is still engaged.");
    } else if (features.hoursSinceLastActivity > 168) {
      probability -= 12;
      addFactor(factors, "Old activity", "negative", 12, "Long inactivity reduces short-term closing odds.");
    }
  }

  if (features.hasPhone) {
    probability += 6;
    addFactor(factors, "Phone available", "positive", 6, "Phone access improves follow-up options.");
  }

  if (!features.hasEmail && !features.hasPhone) {
    probability -= 15;
    addFactor(factors, "Poor contactability", "negative", 15, "Missing reliable contact methods hurts conversion.");
  }

  if (features.pricePoint >= 1000000) {
    probability += 6;
    addFactor(
      factors,
      "Higher price point",
      "positive",
      6,
      "Higher-value opportunities usually justify closer follow-up."
    );
  }

  probability = clamp(Math.round(probability), 1, 99);

  return {
    closeProbability: probability,
    predictedDealValue: estimateDealValue(features),
    predictedCloseWindow: estimateCloseWindow(probability, features),
    factors: factors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 6),
  };
}
