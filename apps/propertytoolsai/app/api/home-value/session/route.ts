import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getComparables } from "@/lib/propertyService";

export const runtime = "nodejs";

/**
 * GET /api/home-value/session?session_id=...
 * Hydrate funnel row for a returning tab (best-effort).
 * Maps raw DB row → structured shape the UI hook expects.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = String(
      searchParams.get("session_id") ?? searchParams.get("sessionId") ?? ""
    ).trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id is required" }, { status: 400 });
    }

    const { data: row, error } = await supabaseServer
      .from("home_value_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.warn("GET /api/home-value/session", error.message);
      return NextResponse.json({ ok: false, error: "Failed to load session." }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ ok: true, session: null, comps: [] });
    }

    // Map raw DB row to the nested structure the hook expects
    const session = {
      sessionId: row.session_id,
      address: {
        fullAddress: row.full_address ?? "",
        street: row.street ?? "",
        city: row.city ?? "",
        state: row.state ?? "",
        zip: row.zip ?? "",
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
      },
      details: {
        propertyType: row.property_type ?? "single_family",
        condition: row.condition ?? "good",
        beds: row.beds ?? undefined,
        baths: row.baths ?? undefined,
        sqft: row.sqft ?? undefined,
        yearBuilt: row.year_built ?? undefined,
        lotSize: row.lot_size ?? undefined,
      },
      estimate:
        row.estimate_value != null
          ? {
              value: Number(row.estimate_value),
              rangeLow: Number(row.estimate_low ?? row.estimate_value * 0.9),
              rangeHigh: Number(row.estimate_high ?? row.estimate_value * 1.1),
              confidence: row.confidence ?? "medium",
              confidenceScore: row.confidence_score ?? 50,
              summary: "",
            }
          : undefined,
    };

    // Fetch comps from warehouse if address exists
    let comps: unknown[] = [];
    if (row.full_address) {
      try {
        const { comps: rawComps } = await getComparables(row.full_address, 12);
        comps = (rawComps ?? []).map((comp) => {
          const soldPrice = comp.sold_price != null ? Number(comp.sold_price) : 0;
          const soldDate = comp.sold_date ? String(comp.sold_date) : "";
          const sqft = comp.comp_property?.sqft != null ? Number(comp.comp_property.sqft) : undefined;
          const beds = comp.comp_property?.beds != null ? Number(comp.comp_property.beds) : undefined;
          const baths = comp.comp_property?.baths != null ? Number(comp.comp_property.baths) : undefined;
          const latVal = comp.comp_property?.lat != null ? Number(comp.comp_property.lat) : undefined;
          const lngVal = comp.comp_property?.lng != null ? Number(comp.comp_property.lng) : undefined;
          const ppsf = sqft && soldPrice > 0 ? soldPrice / sqft : undefined;
          return {
            id: String(comp.id || comp.comp_property_id),
            address: String(comp.comp_property?.address ?? "Comparable property"),
            soldPrice,
            soldDate,
            pricePerSqft: ppsf,
            sqft,
            beds,
            baths,
            distanceMiles: Number(comp.distance_miles ?? 0),
            similarityScore: Number(comp.similarity_score ?? 0),
            matchReasons: [],
            lat: latVal,
            lng: lngVal,
          };
        });
      } catch (err) {
        console.warn("GET /api/home-value/session: comps fetch failed", err);
      }
    }

    // Re-compute adjustment breakdown from stored session data.
    // The estimate engine multipliers are deterministic given property details,
    // so we can reconstruct them without re-running the full pipeline.
    let adjustments: Record<string, number> = {};
    if (row.estimate_value != null) {
      try {
        const { computeHomeValueEstimate } = await import("@/lib/homeValue/estimateEngine");
        const est = computeHomeValueEstimate(
          {
            baselinePpsf: 1, // dummy — we only need the multiplier keys
            sqft: row.sqft ?? 1650,
            beds: row.beds ?? 3,
            baths: row.baths ?? 2,
            propertyType: row.property_type ?? "single family",
            yearBuilt: row.year_built ?? null,
            lotSqft: row.lot_size ?? null,
            condition: (row.condition ?? "average") as "poor" | "fair" | "average" | "good" | "excellent",
            renovation: row.renovated_recently ? "cosmetic" : "none",
            marketTrend: "stable",
          },
          0.08
        );
        const ev = Number(row.estimate_value);
        for (const line of est.adjustments) {
          const dollarImpact = Math.round((line.multiplier - 1) * ev);
          if (dollarImpact !== 0) {
            adjustments[line.key + "Adjustment"] = dollarImpact;
          }
        }
      } catch {
        // Non-fatal — adjustments panel will show empty
      }
    }

    return NextResponse.json({ ok: true, session, comps, adjustments });
  } catch (e: any) {
    console.error("GET /api/home-value/session", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
