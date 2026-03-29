/**
 * SEO property payload as JSON. Uses `/api/property-seo/[slug]` because
 * `/api/property/[address]` is already reserved for address-based ingestion.
 */
import { NextResponse } from "next/server";
import { getPropertySeoRecordBySlug } from "@/lib/property-seo/service";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const record = await getPropertySeoRecordBySlug(slug);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Property not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("property seo api error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load property page data" },
      { status: 500 }
    );
  }
}
