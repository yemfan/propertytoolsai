export type BuyerIntentRoutingInput = {
  preferredCity?: string;
  preferredZip?: string;
  preferredPropertyType?: "single_family" | "condo" | "townhome" | "multi_family";
  timeline?: "now" | "3_months" | "6_months" | "exploring";
  firstTimeBuyer?: boolean;
  alreadyPreapproved?: boolean;
  veteran?: boolean;
  maxHomePrice?: number;
};

export function scoreBuyerIntent(input: BuyerIntentRoutingInput): number {
  let score = 40;

  if (input.timeline === "now") score += 30;
  else if (input.timeline === "3_months") score += 20;
  else if (input.timeline === "6_months") score += 10;

  if (input.preferredCity || input.preferredZip) score += 10;
  if (input.alreadyPreapproved) score += 15;
  if (input.firstTimeBuyer) score += 5;
  if (input.veteran) score += 5;
  if ((input.maxHomePrice ?? 0) >= 800000) score += 10;

  return Math.min(score, 100);
}

export function determineBuyerRouting(input: BuyerIntentRoutingInput) {
  const intentScore = scoreBuyerIntent(input);

  const shouldRouteToLender = !input.alreadyPreapproved || !!input.firstTimeBuyer || !!input.veteran;
  const shouldRouteToAgent =
    intentScore >= 65 || input.timeline === "now" || input.timeline === "3_months";

  return {
    intentScore,
    shouldRouteToLender,
    shouldRouteToAgent,
    routeType:
      shouldRouteToLender && shouldRouteToAgent
        ? "agent_and_lender"
        : shouldRouteToLender
          ? "lender_only"
          : shouldRouteToAgent
            ? "agent_only"
            : "nurture",
  } as const;
}
