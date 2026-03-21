import { dealCloserChat } from "@/lib/dealCloserOpenAI";
import type { OfferStrategyKind } from "@/lib/offerStrategy";

export type OfferGeneratorInput = {
  purchasePrice: number;
  financingType: "cash" | "conventional" | "fha" | "va" | "other";
  closingTimelineDays: number;
  earnestMoneyPercent: number;
  inspectionContingency: boolean;
  appraisalContingency: boolean;
  financingContingency: boolean;
  /** Optional seller concessions as % of price */
  sellerConcessionPercent?: number;
  /** Personal property / extras */
  extras?: string;
};

export type StructuredOfferTerms = {
  purchasePrice: number;
  earnestMoney: number;
  dueDiligenceDays: number;
  financingType: string;
  contingencies: string[];
  closingTimelineDays: number;
  optionalRequests: string[];
  strategyHint: OfferStrategyKind | "custom";
  coverLetterBullets: string[];
};

function financingLabel(t: OfferGeneratorInput["financingType"]) {
  switch (t) {
    case "cash":
      return "Cash";
    case "conventional":
      return "Conventional financing";
    case "fha":
      return "FHA financing";
    case "va":
      return "VA financing";
    default:
      return "Financing per lender approval";
  }
}

/**
 * Structured offer terms — deterministic skeleton; OpenAI can polish cover-letter bullets.
 */
export async function generateOfferTerms(
  input: OfferGeneratorInput,
  strategy: OfferStrategyKind = "balanced"
): Promise<StructuredOfferTerms> {
  const price = Math.max(0, Math.round(input.purchasePrice));
  const em = Math.round((price * Math.max(0.25, Math.min(10, input.earnestMoneyPercent))) / 100);

  const contingencies: string[] = [];
  if (input.inspectionContingency) contingencies.push("Inspection contingency (timeline as per contract)");
  if (input.appraisalContingency) contingencies.push("Appraisal contingency");
  if (input.financingContingency) contingencies.push("Financing contingency");

  const optionalRequests: string[] = [];
  if (input.sellerConcessionPercent && input.sellerConcessionPercent > 0) {
    optionalRequests.push(
      `Seller concessions up to ${input.sellerConcessionPercent}% toward allowable buyer costs (subject to lender/program limits).`
    );
  }
  if (input.extras?.trim()) {
    optionalRequests.push(input.extras.trim());
  }

  const baseBullets = [
    `Offer price $${price.toLocaleString()} with ${financingLabel(input.financingType)}.`,
    `Earnest money $${em.toLocaleString()} (${input.earnestMoneyPercent}% of price) held per escrow.`,
    `Target closing ~${input.closingTimelineDays} days from acceptance; adjust to seller needs if reasonable.`,
  ];

  const raw = await dealCloserChat({
    system: `You write concise MLS/offer cover letter bullets for agents. Return ONLY JSON: { "coverLetterBullets": string[] } with 3–5 bullets, professional, no legal guarantees.`,
    user: `Terms:
${JSON.stringify({
  price,
  financing: financingLabel(input.financingType),
  earnestMoney: em,
  closingDays: input.closingTimelineDays,
  contingencies,
  optionalRequests,
  strategy,
})}`,
    jsonMode: true,
    maxTokens: 400,
    temperature: 0.35,
  });

  let coverLetterBullets = baseBullets;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { coverLetterBullets?: string[] };
      if (Array.isArray(parsed.coverLetterBullets) && parsed.coverLetterBullets.length) {
        coverLetterBullets = parsed.coverLetterBullets.map(String);
      }
    } catch {
      /* keep base */
    }
  }

  return {
    purchasePrice: price,
    earnestMoney: em,
    dueDiligenceDays: input.inspectionContingency ? 10 : 0,
    financingType: financingLabel(input.financingType),
    contingencies,
    closingTimelineDays: input.closingTimelineDays,
    optionalRequests,
    strategyHint: strategy,
    coverLetterBullets,
  };
}
