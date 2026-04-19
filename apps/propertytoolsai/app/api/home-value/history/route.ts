import { NextResponse, type NextRequest } from "next/server";
import { getPropertyByAddress, getPropertyHistory } from "@/lib/propertyService";

export const runtime = "nodejs";

/**
 * GET /api/home-value/history?address=...&limit=52
 *
 * Returns value snapshots for a property address, suitable for
 * rendering a Zestimate-style value-over-time chart.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json(
      { success: false, error: "address query parameter is required" },
      { status: 400 }
    );
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 52),
    104
  );

  try {
    const property = await getPropertyByAddress(address);
    if (!property) {
      return NextResponse.json({
        success: true,
        snapshots: [],
        message: "Property not found in warehouse",
      });
    }

    const snapshots = await getPropertyHistory(property.id, limit);

    const points = snapshots
      .filter((s) => s.estimated_value != null && s.estimated_value > 0)
      .map((s) => ({
        date: s.created_at,
        value: s.estimated_value!,
        pricePerSqft: s.price_per_sqft ?? undefined,
      }))
      .reverse(); // oldest first for chart rendering

    return NextResponse.json({
      success: true,
      propertyId: property.id,
      snapshots: points,
    });
  } catch (e) {
    console.error("[home-value-history]", e);
    return NextResponse.json(
      { success: false, error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
