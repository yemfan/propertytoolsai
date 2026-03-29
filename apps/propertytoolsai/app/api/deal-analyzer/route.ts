import { NextResponse } from "next/server";
import {
  resolveProperty,
  createPropertyReport,
} from "@/lib/services/propertyService";

type Body = {
  address: string;
};

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    const { address } = (await req.json()) as Body;
    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const { property, property_id } = await resolveProperty(
      address.trim(),
      forceRefresh
    );

    const price = property.price ?? 0;
    const rent = property.rent ?? 0;
    const expenses = 2000;

    const cash_flow = rent - expenses;
    const cap_rate = price > 0 ? ((rent * 12) / price) * 100 : 0;
    const roi = price > 0 ? ((cash_flow * 12) / price) * 100 : 0;

    let deal_score = 50;
    if (cash_flow > 0) deal_score += 20;
    if (cap_rate > 6) deal_score += 15;
    if (roi > 10) deal_score += 15;
    deal_score = Math.max(0, Math.min(100, deal_score));

    await createPropertyReport({
      property_id,
      source: "deal",
      rent_estimate: rent,
      cash_flow,
      cap_rate,
      roi,
      deal_score,
      metrics_json: { property, expenses },
    });

    return NextResponse.json({
      ok: true,
      property,
      cash_flow,
      cap_rate,
      roi,
      deal_score,
    });
  } catch (e: any) {
    console.error("deal-analyzer error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

