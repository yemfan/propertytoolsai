import { NextResponse } from "next/server";
import { getListingsAdapter } from "@/lib/listings/adapters";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adapter = getListingsAdapter();
    const listing = await adapter.getListing(id);

    if (!listing) {
      return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      provider: adapter.name,
      listing,
    });
  } catch (error) {
    console.error("listing detail error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load listing",
      },
      { status: 500 }
    );
  }
}
