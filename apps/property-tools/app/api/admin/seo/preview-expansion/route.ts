import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { buildExpansionInputsForCity, getDefaultExpansionCities } from "@/lib/seo-generator/keywords";
import { buildSeoSlug } from "@/lib/seo-generator/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const cities = getDefaultExpansionCities();
    const preview = cities.flatMap((city) =>
      buildExpansionInputsForCity(city).slice(0, 8).map((input) => ({
        ...input,
        slug: buildSeoSlug(input),
      }))
    );

    return NextResponse.json({ success: true, preview });
  } catch (error) {
    console.error("seo preview expansion error:", error);
    return NextResponse.json({ success: false, error: "Failed to preview expansion" }, { status: 500 });
  }
}
