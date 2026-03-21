import { NextResponse } from "next/server";
import {
  resolveProperty,
  createPropertyReport,
} from "@/lib/services/propertyService";
import { consumeTokensForTool } from "@/lib/consumeTokens";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMarketplaceSessionId } from "@/lib/marketplaceSessionId";

type Body = {
  address: string;
};

export async function POST(req: Request) {
  try {
    const gate = await consumeTokensForTool({
      req,
      tool: "rental_analyzer",
      requireAuth: true,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: (gate as any).error ?? (gate as any).message ?? "Access denied",
          plan: gate.plan,
          tokens_remaining: gate.tokensRemaining,
        },
        { status: (gate as any).status ?? 402 }
      );
    }

    const user = await getUserFromRequest(req);

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

    const rent = property.rent ?? 0;
    const price = property.price ?? 0;
    const expenses = 2000;

    const cash_flow = rent - expenses;
    const cap_rate = price > 0 ? ((rent * 12) / price) * 100 : null;

    await createPropertyReport({
      property_id,
      source: "rental",
      rent_estimate: rent,
      cash_flow,
      cap_rate,
      metrics_json: { property, expenses },
    });

    // Marketplace tracking: log rental analysis for this address.
    try {
      const sessionId = getMarketplaceSessionId(req);
      await supabaseServer.rpc(
        "log_tool_usage_and_update_opportunity",
        {
          p_user_id: user?.id ?? null,
          p_session_id: sessionId,
          p_tool_name: "rental",
          p_property_address: address.trim(),
          p_action: "generate",
          p_estimated_value: null,
        } as any
      );
    } catch {}

    return NextResponse.json({
      ok: true,
      property,
      rent_estimate: rent,
      cash_flow,
      cap_rate,
    });
  } catch (e: any) {
    console.error("rental-analyzer error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

