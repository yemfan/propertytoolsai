import { NextResponse } from "next/server";
import { fetchSimilarProperties, type RecommendationProperty } from "@/lib/propertyData";
import { calculateDealScore } from "@/lib/dealScoring";
import { explainRecommendations } from "@/lib/recommendationAi";

export const runtime = "nodejs";

type InputBody = {
  property?: {
    address?: string;
    location?: string;
    price?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
  };
  limit?: number;
};

function normalizeSubject(input: NonNullable<InputBody["property"]>): RecommendationProperty {
  const address = String(input.address ?? "").trim();
  const location = String(input.location ?? address).trim();
  const price = Number(input.price);
  const beds = Number(input.beds);
  const baths = Number(input.baths);
  const sqft = Number(input.sqft);

  if (!address || !location || !Number.isFinite(price) || price <= 0 || !Number.isFinite(sqft) || sqft <= 0) {
    throw new Error("Invalid subject property. address/location/price/sqft are required.");
  }

  const zipMatch = location.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0].slice(0, 5) : null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "Local Area";

  return {
    id: "subject",
    address,
    location,
    city,
    zip,
    price,
    beds: Number.isFinite(beds) ? beds : 0,
    baths: Number.isFinite(baths) ? baths : 0,
    sqft,
    rentMonthly: null,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as InputBody;
    if (!body.property) {
      return NextResponse.json({ ok: false, error: "property is required" }, { status: 400 });
    }

    const subject = normalizeSubject(body.property);
    const similar = await fetchSimilarProperties(subject);
    const ranked = similar
      .map((p) => ({ property: p, dealScore: calculateDealScore(p, subject) }))
      .sort((a, b) => b.dealScore - a.dealScore);

    const limit = Math.min(5, Math.max(3, Number(body.limit ?? 3)));
    const recommended = ranked.slice(0, limit);
    const explanation = await explainRecommendations(subject, recommended);

    return NextResponse.json({
      ok: true,
      subject,
      recommended,
      explanation,
    });
  } catch (e: any) {
    console.error("POST /api/recommendations", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
