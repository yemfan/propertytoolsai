import { NextResponse } from "next/server";
import { getPropertyData } from "@/lib/getPropertyData";
import {
  getPropertyByAddress,
  getLatestSnapshot,
  getPropertyHistory,
  getComparables,
} from "@/lib/propertyService";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  try {
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "true";

    const { address: addressParamRaw } = await ctx.params;
    const addressParam = addressParamRaw ?? "";
    const address = decodeURIComponent(addressParam).trim();
    if (!address) {
      return NextResponse.json(
        { error: "address is required" },
        { status: 400 }
      );
    }

    // Ensure ingestion has run so warehouse rows exist.
    await getPropertyData(address, refresh);

    const property = await getPropertyByAddress(address);
    if (!property) {
      return NextResponse.json(
        { error: "Property not found after ingestion" },
        { status: 404 }
      );
    }

    const [latest_snapshot, history, compsResult] = await Promise.all([
      getLatestSnapshot(property.id),
      getPropertyHistory(property.id, 60),
      getComparables(address, 10),
    ]);

    return NextResponse.json({
      ok: true,
      property,
      latest_snapshot,
      history,
      comps: compsResult.comps,
    });
  } catch (e: any) {
    console.error("property/[address] API error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

