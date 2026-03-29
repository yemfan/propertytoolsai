import { NextResponse } from "next/server";
import { getPropertyData } from "@/lib/getPropertyData";
import { getPropertyByAddress, getComparables } from "@/lib/propertyService";
import { consumeTokensForTool } from "@/lib/consumeTokens";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMarketplaceSessionId } from "@/lib/marketplaceSessionId";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Usage limit paywall (only for logged-in free users).
    const user = await getUserFromRequest(req);
    if (user) {
      const { data: out } = await supabaseServer.rpc("increment_usage", {
        p_user_id: user.id,
        p_tool: "estimator",
      } as any);
      if (out && (out as any).ok === false) {
        return NextResponse.json(
          { ok: false, error: "You’ve reached your free limit. Upgrade to continue." },
          { status: 402 }
        );
      }
    }

    // Estimator is a basic tool: guests are allowed. Logged-in users consume 1 token.
    const gate = await consumeTokensForTool({
      req,
      tool: "estimator",
      requireAuth: false,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: (gate as any).error ?? (gate as any).message ?? "Access denied",
          plan: gate.plan,
          tokens_remaining: gate.tokensRemaining,
        },
        { status: (gate as any).status ?? 402 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      refresh?: boolean;
    };

    const address = String(body.address ?? "").trim();
    const refresh = Boolean(body.refresh);

    if (!address) {
      return NextResponse.json(
        { ok: false, error: "address is required." },
        { status: 400 }
      );
    }

    // Ensure ingestion has populated the warehouse rows needed for comps.
    await getPropertyData(address, refresh);

    const property = await getPropertyByAddress(address);
    if (!property) {
      return NextResponse.json(
        { ok: false, error: "Property not found after ingestion." },
        { status: 404 }
      );
    }

    const compsResult = await getComparables(address, 10);
    const comps = compsResult.comps ?? [];

    // Compute point estimate from comp sold price per sqft.
    const pricedComps = comps
      .map((c) => {
        const soldPrice = c.sold_price != null ? Number(c.sold_price) : null;
        const sqft = c.comp_property?.sqft != null ? Number(c.comp_property.sqft) : null;
        if (soldPrice == null || sqft == null || !isFinite(soldPrice) || !isFinite(sqft) || sqft <= 0) {
          return null;
        }
        return { soldPrice, sqft, pricePerSqft: soldPrice / sqft };
      })
      .filter(Boolean) as Array<{ soldPrice: number; sqft: number; pricePerSqft: number }>;

    const avgPricePerSqft =
      pricedComps.length > 0
        ? pricedComps.reduce((sum, c) => sum + c.pricePerSqft, 0) /
          pricedComps.length
        : null;

    const subjectSqft = Number(property.sqft ?? 0) || pricedComps[0]?.sqft || 1500;

    const estimatedValue =
      avgPricePerSqft != null ? avgPricePerSqft * subjectSqft : null;

    const low = estimatedValue != null ? estimatedValue * 0.92 : null;
    const high = estimatedValue != null ? estimatedValue * 1.08 : null;

    const summary =
      pricedComps.length > 0 && avgPricePerSqft != null
        ? `Based on ${pricedComps.length} nearby comparable sold properties, the average price/sqft is about $${avgPricePerSqft.toFixed(
            0
          )}. Using your square footage, the estimated value is approximately $${Math.round(
            estimatedValue ?? 0
          ).toLocaleString()} with an expected range of $${Math.round(
            low ?? 0
          ).toLocaleString()} to $${Math.round(high ?? 0).toLocaleString()}.`
        : `We couldn’t find enough comparable sold history for this address yet. Import an MLS CSV sold history first.`;

    // Marketplace tracking: log that this address was evaluated.
    // Best-effort: if the DB call fails, we still return the estimate.
    try {
      const sessionId = getMarketplaceSessionId(req);
      await supabaseServer.rpc(
        "log_tool_usage_and_update_opportunity",
        {
          p_user_id: user?.id ?? null,
          p_session_id: sessionId,
          p_tool_name: "estimator",
          p_property_address: address,
          p_action: "generate",
          p_estimated_value: estimatedValue,
        } as any
      );
    } catch {}

    return NextResponse.json({
      ok: true,
      property: {
        address: property.address,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
      },
      estimate: {
        estimatedValue,
        low,
        high,
        summary,
      },
      compsCount: pricedComps.length,
    });
  } catch (e: any) {
    console.error("property/estimate error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

