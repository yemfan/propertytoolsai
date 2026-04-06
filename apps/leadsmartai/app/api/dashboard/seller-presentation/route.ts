import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getComparables, getLatestSnapshot } from "@/lib/propertyService";
import {
  generateSellerPresentationAI,
  type PropertyContext,
} from "@/lib/sellerPresentationAI";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();

    const body = (await req.json().catch(() => ({}))) as {
      propertyIds?: string[];
      clientName?: string;
    };

    const propertyIds = Array.isArray(body.propertyIds) ? body.propertyIds.slice(0, 5) : [];
    const clientName = String(body.clientName ?? "").trim();

    if (!propertyIds.length) {
      return NextResponse.json(
        { ok: false, error: "Select at least one property." },
        { status: 400 }
      );
    }

    // Fetch property details from warehouse.
    const { data: warehouseRows, error: whErr } = await supabaseServer
      .from("properties_warehouse")
      .select("id, address, city, state, zip_code, beds, baths, sqft, property_type, year_built")
      .in("id", propertyIds);

    if (whErr || !warehouseRows?.length) {
      return NextResponse.json(
        { ok: false, error: "Could not load properties." },
        { status: 404 }
      );
    }

    // Build context for each property: details + snapshot + comps.
    const propertyContexts: PropertyContext[] = [];
    const propertyDetails: Array<Record<string, unknown>> = [];

    for (const row of warehouseRows as Record<string, unknown>[]) {
      const propId = String(row.id);
      const address = String(row.address ?? "");

      const snapshot = await getLatestSnapshot(propId).catch(() => null);
      const compsResult = await getComparables(address, 5).catch(() => ({ comps: [] }));

      const soldComps = (compsResult.comps ?? [])
        .map((c: Record<string, unknown>) => {
          const cp = c.comp_property as Record<string, unknown> | null;
          const price = Number(c.sold_price ?? 0);
          const sqft = Number(cp?.sqft ?? 0);
          if (!price || !sqft) return null;
          return {
            address: String(cp?.address ?? ""),
            price,
            sqft,
            pricePerSqft: price / sqft,
            soldDate: String(c.sold_date ?? ""),
            distanceMiles: Number(c.distance_miles ?? 0),
            beds: (cp?.beds as number) ?? null,
            baths: (cp?.baths as number) ?? null,
          };
        })
        .filter(Boolean) as Array<{
          address: string;
          price: number;
          sqft: number;
          pricePerSqft: number;
          soldDate: string;
          distanceMiles: number;
          beds: number | null;
          baths: number | null;
        }>;

      const avgPricePerSqft =
        soldComps.length > 0
          ? soldComps.reduce((s, c) => s + c.pricePerSqft, 0) / soldComps.length
          : null;

      const subjectSqft = Number(row.sqft ?? 0) || null;
      const estimatedValue =
        avgPricePerSqft && subjectSqft
          ? avgPricePerSqft * subjectSqft
          : snapshot?.estimated_value != null
            ? Number(snapshot.estimated_value)
            : null;

      const low = estimatedValue ? estimatedValue * 0.92 : null;
      const high = estimatedValue ? estimatedValue * 1.08 : null;

      propertyContexts.push({
        address,
        city: (row.city as string) ?? null,
        state: (row.state as string) ?? null,
        beds: (row.beds as number) ?? null,
        baths: (row.baths as number) ?? null,
        sqft: subjectSqft,
        propertyType: (row.property_type as string) ?? null,
        yearBuilt: (row.year_built as number) ?? null,
        estimatedValue,
        low,
        high,
        avgPricePerSqft,
        comps: soldComps.map((c) => ({
          address: c.address,
          price: c.price,
          sqft: c.sqft,
          soldDate: c.soldDate,
          distanceMiles: c.distanceMiles,
        })),
      });

      propertyDetails.push({
        id: propId,
        address,
        city: row.city,
        state: row.state,
        beds: row.beds,
        baths: row.baths,
        sqft: row.sqft,
        propertyType: row.property_type,
        yearBuilt: row.year_built,
        estimatedValue,
        low,
        high,
        avgPricePerSqft,
        comps: soldComps.slice(0, 3),
      });
    }

    // Generate AI content.
    const ai = await generateSellerPresentationAI(propertyContexts);

    const presentationData = {
      type: "seller_comparison",
      clientName,
      generated_at: new Date().toISOString(),
      executive_summary: ai.executive_summary,
      market_overview: ai.market_overview,
      recommendation: ai.recommendation,
      properties: propertyDetails.map((p) => ({
        ...p,
        ai: ai.properties[String(p.address)] ?? null,
      })),
    };

    // Save to presentations table.
    const addressLabel = propertyDetails.map((p) => p.address).join(" | ");
    const { data: inserted, error: insertErr } = await supabaseServer
      .from("presentations")
      .insert({
        agent_id: ctx.userId,
        property_address: addressLabel.slice(0, 500),
        data: presentationData,
      })
      .select("id")
      .single();

    if (insertErr || !inserted?.id) {
      return NextResponse.json(
        { ok: false, error: insertErr?.message ?? "Failed to save presentation." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      presentationId: String(inserted.id),
      data: presentationData,
    });
  } catch (e: unknown) {
    console.error("seller-presentation error", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error." },
      { status: 500 }
    );
  }
}
