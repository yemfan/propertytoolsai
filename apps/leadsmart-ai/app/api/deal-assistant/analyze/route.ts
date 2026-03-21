import { NextResponse } from "next/server";
import { generateOfferStrategy, type OfferStrategyInput } from "@/lib/offerStrategy";
import { analyzeDealRisks } from "@/lib/risk";
import { generateOfferTerms, type OfferGeneratorInput } from "@/lib/offerGenerator";
import { suggestAllNegotiationResponses } from "@/lib/negotiation";

export const runtime = "nodejs";

type Body = {
  propertyAddress?: string;
  notes?: string;
  listPrice: number;
  budgetMax?: number;
  comparablesMedian?: number;
  daysOnMarket: number;
  marketHeat: OfferStrategyInput["marketHeat"];
  competingOfferCount?: number;
  financingType: OfferGeneratorInput["financingType"];
  closingTimelineDays: number;
  earnestMoneyPercent: number;
  inspectionContingency: boolean;
  appraisalContingency: boolean;
  financingContingency: boolean;
  sellerConcessionPercent?: number;
  extras?: string;
};

function parseBody(json: unknown): Body | null {
  if (!json || typeof json !== "object") return null;
  const b = json as Record<string, unknown>;
  const listPrice = Number(b.listPrice);
  if (!Number.isFinite(listPrice) || listPrice <= 0) return null;
  const daysOnMarket = Math.max(0, Math.round(Number(b.daysOnMarket) || 0));
  const heat = String(b.marketHeat || "balanced");
  const marketHeat =
    heat === "hot" || heat === "cool" || heat === "balanced" ? heat : "balanced";
  const fin = String(b.financingType || "conventional");
  const financingType: OfferGeneratorInput["financingType"] =
    fin === "cash" || fin === "conventional" || fin === "fha" || fin === "va" || fin === "other"
      ? fin
      : "conventional";

  return {
    propertyAddress: typeof b.propertyAddress === "string" ? b.propertyAddress : undefined,
    notes: typeof b.notes === "string" ? b.notes : undefined,
    listPrice,
    budgetMax: b.budgetMax != null && b.budgetMax !== "" ? Number(b.budgetMax) : undefined,
    comparablesMedian:
      b.comparablesMedian != null && b.comparablesMedian !== ""
        ? Number(b.comparablesMedian)
        : undefined,
    daysOnMarket,
    marketHeat,
    competingOfferCount:
      b.competingOfferCount != null && b.competingOfferCount !== ""
        ? Math.max(0, Math.round(Number(b.competingOfferCount)))
        : undefined,
    financingType,
    closingTimelineDays: Math.max(7, Math.min(120, Math.round(Number(b.closingTimelineDays) || 30))),
    earnestMoneyPercent: Math.max(0.25, Math.min(10, Number(b.earnestMoneyPercent) || 1)),
    inspectionContingency: Boolean(b.inspectionContingency),
    appraisalContingency: b.appraisalContingency !== false,
    financingContingency: b.financingContingency !== false,
    sellerConcessionPercent:
      b.sellerConcessionPercent != null && b.sellerConcessionPercent !== ""
        ? Math.max(0, Math.min(6, Number(b.sellerConcessionPercent)))
        : undefined,
    extras: typeof b.extras === "string" ? b.extras : undefined,
  };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = parseBody(json);
    if (!body) {
      return NextResponse.json({ ok: false, message: "Invalid body: listPrice required." }, { status: 400 });
    }

    const strategyInput: OfferStrategyInput = {
      listPrice: body.listPrice,
      budgetMax: body.budgetMax,
      comparablesMedian: body.comparablesMedian,
      daysOnMarket: body.daysOnMarket,
      marketHeat: body.marketHeat,
      competingOfferCount: body.competingOfferCount,
      propertyAddress: body.propertyAddress,
      notes: body.notes,
    };

    const strategy = await generateOfferStrategy(strategyInput);

    const risks = analyzeDealRisks({
      listPrice: body.listPrice,
      recommendedOffer: strategy.recommendedPrice,
      comparablesMedian: body.comparablesMedian,
      daysOnMarket: body.daysOnMarket,
      marketHeat: body.marketHeat,
    });

    const offerTermsInput: OfferGeneratorInput = {
      purchasePrice: strategy.recommendedPrice,
      financingType: body.financingType,
      closingTimelineDays: body.closingTimelineDays,
      earnestMoneyPercent: body.earnestMoneyPercent,
      inspectionContingency: body.inspectionContingency,
      appraisalContingency: body.appraisalContingency,
      financingContingency: body.financingContingency,
      sellerConcessionPercent: body.sellerConcessionPercent,
      extras: body.extras,
    };

    const [offerTerms, negotiation] = await Promise.all([
      generateOfferTerms(offerTermsInput, strategy.strategy),
      suggestAllNegotiationResponses({
        propertyAddress: body.propertyAddress,
        listPrice: body.listPrice,
        recommendedPrice: strategy.recommendedPrice,
        strategy: strategy.strategy,
        risks,
        buyerNotes: body.notes,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      strategy,
      risks,
      offerTerms,
      negotiation,
    });
  } catch (e) {
    console.error("deal-assistant analyze", e);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
