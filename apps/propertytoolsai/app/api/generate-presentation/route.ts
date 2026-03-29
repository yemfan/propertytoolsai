import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPropertyData } from "@/lib/getPropertyData";
import { getPropertyByAddress } from "@/lib/propertyService";
import { generateOpenHouseReportData } from "@/lib/openHouseReport";
import { generatePresentationAISections } from "@/lib/presentationAI";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { consumeTokensForTool } from "@/lib/consumeTokens";

type Body = {
  address: string;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const gate = await consumeTokensForTool({
      req,
      tool: "presentation",
      requireAuth: true,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          success: false,
          message: (gate as any).error ?? (gate as any).message ?? "Access denied",
          plan: gate.plan,
          tokens_remaining: gate.tokensRemaining,
        },
        { status: (gate as any).status ?? 402 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const address = String(body.address ?? "").trim();

    if (!address) {
      return NextResponse.json(
        { success: false, message: "address is required" },
        { status: 400 }
      );
    }

    // `presentations.agent_id` is Auth user UUID (see schema); never use CRM `agents.id` bigint here.
    const ctx = await getCurrentAgentContext();
    const presentationAgentId = ctx.userId;

    // 1) Ensure property warehouse rows + snapshots exist.
    await getPropertyData(address, true);

    const property = await getPropertyByAddress(address);
    if (!property) {
      return NextResponse.json(
        {
          success: false,
          message: "Property not found after ingestion. Import MLS data or try again.",
        },
        { status: 404 }
      );
    }

    // 2) Generate estimator + CMA comp set using existing report logic.
    const reportData = await generateOpenHouseReportData({
      propertyId: property.id,
      address: property.address,
    });

    const aiSections = await generatePresentationAISections({
      address: property.address,
      estimate: reportData.estimated,
      comps: reportData.comps.map((c) => ({
        address: c.address,
        price: c.price,
        sqft: c.sqft,
        soldDate: c.soldDate,
        distanceMiles: c.distanceMiles,
      })),
    });

    // 3) Combine into structured JSON for storage + preview.
    const presentationData = {
      property: reportData.property,
      estimate: reportData.estimated,
      comps: reportData.comps,
      pricing_strategy: aiSections.pricing_strategy,
      market_insights: aiSections.market_insights,
      marketing_plan: aiSections.marketing_plan,
    };

    // 4) Save to `presentations`.
    const { data: inserted, error } = await supabaseServer
      .from("presentations")
      .insert({
        agent_id: presentationAgentId,
        property_address: property.address,
        data: presentationData,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      return NextResponse.json(
        { success: false, message: error?.message ?? "Failed to save presentation." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      presentation_id: String(inserted.id),
      data: presentationData,
    });
  } catch (e: any) {
    console.error("generate-presentation error", e);
    return NextResponse.json(
      { success: false, message: e?.message ?? "Server error generating presentation." },
      { status: 500 }
    );
  }
}

