import { NextResponse } from "next/server";
import {
  getPropertyByAddress,
  getComparables,
  type PropertyRow,
} from "@/lib/propertyService";
import { getPropertyData } from "@/lib/getPropertyData";
import { loadValuationBundleFromRentcast } from "@/lib/valuation/adapters/rentcast";
import { consumeTokensForTool } from "@/lib/consumeTokens";
import { getCmaUsage, incrementCmaUsage } from "@/lib/cmaUsage";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMarketplaceSessionId } from "@/lib/marketplaceSessionId";
import { recordLeadEvent, scoreLead } from "@/lib/leadScoring";

type PropertyCore = PropertyRow;

type PropertyInput = {
  address: string;
  lead_id?: string | number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  condition?: string;
};

type ComparableResponse = {
  address: string;
  price: number;
  sqft: number;
  beds: number | null;
  baths: number | null;
  distanceMiles: number;
  soldDate: string;
  propertyType: string | null;
  pricePerSqft: number;
};

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    // Daily CMA limits by role:
    // anonymous=2, user=5, agent=10.
    const preUsage = await getCmaUsage(request);
    if (preUsage.reached) {
      return NextResponse.json(
        {
          error: "You’ve reached your limit",
          usage: preUsage,
        },
        { status: 402 }
      );
    }

    const gate = await consumeTokensForTool({
      req: request,
      tool: "cma",
      requireAuth: false,
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

    const postUsage = await incrementCmaUsage(request);

    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    const body = (await request.json().catch(() => ({}))) as PropertyInput;
    const address = body.address?.trim();
    const leadId = String((body as any).lead_id ?? "").trim();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    /**
     * Ensure the property exists in the warehouse. If not, hydrate
     * it from the property data source (Rentcast). Previously the
     * CMA returned a hard 404 when the property wasn't in the
     * warehouse — now it creates the record on-demand.
     */
    try {
      await getPropertyData(address, forceRefresh);
    } catch {
      /* best-effort — getPropertyByAddress below handles the miss */
    }

    let subject = await getPropertyByAddress(address);

    /**
     * Rentcast AVM + property enrichment. Called early so we have:
     * 1. A professional AVM to fall back on when local comps = 0
     * 2. Real property details (sqft, beds, baths, yearBuilt)
     */
    let rentcastAvm: number | null = null;
    let rentcastDetails: Record<string, unknown> | null = null;
    try {
      if (process.env.RENTCAST_API_KEY?.trim()) {
        const bundle = await loadValuationBundleFromRentcast({ address });
        rentcastAvm = bundle.apiEstimate ?? null;
        if (bundle.subjectDetails) {
          rentcastDetails = bundle.subjectDetails as Record<string, unknown>;
        }
      }
    } catch (e) {
      console.error("[smart-cma] Rentcast fetch failed:", e);
    }

    if (!subject) {
      // Even without a warehouse record, we can still produce a
      // CMA using Rentcast data. Build a minimal subject object.
      if (rentcastAvm && rentcastAvm > 0) {
        subject = {
          id: "",
          address,
          city: null,
          state: null,
          zip_code: null,
          lat: null,
          lng: null,
          property_type: rentcastDetails?.propertyType != null ? String(rentcastDetails.propertyType) : null,
          beds: rentcastDetails?.beds != null ? Number(rentcastDetails.beds) : null,
          baths: rentcastDetails?.baths != null ? Number(rentcastDetails.baths) : null,
          sqft: rentcastDetails?.sqft != null ? Number(rentcastDetails.sqft) : null,
          lot_size: rentcastDetails?.lotSize != null ? Number(rentcastDetails.lotSize) : null,
          year_built: rentcastDetails?.yearBuilt != null ? Number(rentcastDetails.yearBuilt) : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as PropertyRow;
      } else {
        return NextResponse.json(
          { error: "Property not found. Try a different address or check the spelling." },
          { status: 404 }
        );
      }
    }

    // Enrich subject with Rentcast details if warehouse data is sparse
    if (rentcastDetails) {
      if (!subject.sqft && rentcastDetails.sqft) subject = { ...subject, sqft: Number(rentcastDetails.sqft) };
      if (!subject.beds && rentcastDetails.beds) subject = { ...subject, beds: Number(rentcastDetails.beds) };
      if (!subject.baths && rentcastDetails.baths) subject = { ...subject, baths: Number(rentcastDetails.baths) };
      if (!subject.year_built && rentcastDetails.yearBuilt) subject = { ...subject, year_built: Number(rentcastDetails.yearBuilt) };
      if (!subject.property_type && rentcastDetails.propertyType) subject = { ...subject, property_type: String(rentcastDetails.propertyType) };
    }

    const compsResult = await getComparables(address, 10);

    const comps: ComparableResponse[] = (compsResult.comps ?? [])
      .filter((c) => c.sold_price != null && c.comp_property?.sqft != null && (c.comp_property?.sqft ?? 0) > 0)
      .map((c) => {
        const compProp = c.comp_property;
        const price = Number(c.sold_price ?? 0);
        const sqft = Number(compProp?.sqft ?? 0);
        const pricePerSqft = sqft > 0 ? price / sqft : 0;
        const soldDate = c.sold_date ? new Date(c.sold_date).toLocaleDateString() : "—";

        return {
          address: compProp?.address ?? "—",
          price,
          sqft,
          beds: compProp?.beds ?? null,
          baths: compProp?.baths ?? null,
          distanceMiles: Number(c.distance_miles ?? 0),
          soldDate,
          propertyType: compProp?.property_type ?? null,
          pricePerSqft,
        };
      });

    const subjectSqft =
      Number(body.sqft ?? subject.sqft ?? 1500) || 1500;

    const avgPricePerSqft =
      comps.length > 0
        ? comps.reduce((sum, c) => sum + c.pricePerSqft, 0) / comps.length
        : 0;

    /**
     * Estimate: use comp-based value when comps are available,
     * Rentcast AVM when they're not. Previously returned $0 with
     * a "not enough comparables" message when comps were missing.
     */
    let estimatedValue = avgPricePerSqft * subjectSqft;
    if (estimatedValue <= 0 && rentcastAvm && rentcastAvm > 0) {
      estimatedValue = rentcastAvm;
    }
    const low = estimatedValue * 0.92;
    const high = estimatedValue * 1.08;

    const now = Date.now();
    const daysSinceSale = comps
      .map((c) => {
        const t = new Date(c.soldDate).getTime();
        return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / (1000 * 60 * 60 * 24))) : null;
      })
      .filter((x): x is number => x != null);

    const avgDom =
      daysSinceSale.length > 0
        ? daysSinceSale.reduce((a, b) => a + b, 0) / daysSinceSale.length
        : 30;

    const aggressiveDays = Math.max(5, Math.round(avgDom * 0.8));
    const marketDays = Math.max(5, Math.round(avgDom));
    const premiumDays = Math.max(5, Math.round(avgDom * 1.2));

    const estimatedStrategies = {
      aggressive: estimatedValue * 0.95,
      market: estimatedValue,
      premium: estimatedValue * 1.03,
    };

    const subjectCondition = (body as any).condition ?? "Average";

    const summary = comps.length
      ? `Based on ${comps.length} nearby comparable sold properties, the average price/sqft is about $${avgPricePerSqft.toFixed(
          0
        )}. Using your subject’s square footage, the estimated value is approximately $${Math.round(
          estimatedValue
        ).toLocaleString()} with an expected range of $${Math.round(
          low
        ).toLocaleString()} to $${Math.round(high).toLocaleString()}.`
      : rentcastAvm && rentcastAvm > 0
        ? `Estimated value of $${Math.round(estimatedValue).toLocaleString()} based on automated valuation model (range $${Math.round(low).toLocaleString()} to $${Math.round(high).toLocaleString()}). Local comparable data is limited — the estimate may improve as more nearby sales are recorded.`
        : `We couldn’t find enough comparable sold history for this address yet. Try a different address or check the spelling.`;

    // Marketplace tracking: log that CMA was generated for this address.
    // Best-effort: failures must not break the tool response.
    try {
      const sessionId = getMarketplaceSessionId(request);
      await supabaseServer.rpc(
        "log_tool_usage_and_update_opportunity",
        {
          p_user_id: user?.id ?? null,
          p_session_id: sessionId,
          p_tool_name: "cma",
          p_property_address: address,
          p_action: "generate",
          p_estimated_value: estimatedValue,
        } as any
      );
    } catch {}

    if (leadId) {
      try {
        await recordLeadEvent({
          lead_id: leadId as any,
          event_type: "cma_run",
          metadata: { address },
        });
        await scoreLead(leadId, true);
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      usage: postUsage,
      subject: {
        address: subject.address,
        beds: subject.beds ?? 0,
        baths: subject.baths ?? 0,
        sqft: subject.sqft ?? subjectSqft,
        propertyType: subject.property_type ?? null,
        yearBuilt: subject.year_built ?? 0,
        condition: subjectCondition,
      },
      comps,
      avgPricePerSqft,
      estimatedValue,
      low,
      high,
      strategies: {
        aggressive: estimatedStrategies.aggressive,
        market: estimatedStrategies.market,
        premium: estimatedStrategies.premium,
        daysOnMarket: {
          aggressive: aggressiveDays,
          market: marketDays,
          premium: premiumDays,
        },
      },
      summary,
    });
  } catch (e: any) {
    console.error("cma error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}


