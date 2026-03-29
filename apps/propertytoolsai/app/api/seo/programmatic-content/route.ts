import { NextResponse } from "next/server";
import {
  getCachedProgrammaticPayload,
  getProgrammaticLocationBySlug,
  getProgrammaticToolBySlug,
} from "@/lib/programmaticSeo";

export const runtime = "nodejs";

/**
 * Debug / headless: returns cached programmatic SEO payload JSON.
 * GET /api/seo/programmatic-content?tool=cap-rate-calculator&location=los-angeles-ca
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const toolSlug = url.searchParams.get("tool")?.trim() ?? "";
  const locationSlug = url.searchParams.get("location")?.trim() ?? "";

  if (!toolSlug || !locationSlug) {
    return NextResponse.json(
      { ok: false, error: "Query params `tool` and `location` are required" },
      { status: 400 }
    );
  }

  const tool = getProgrammaticToolBySlug(toolSlug);
  const loc = getProgrammaticLocationBySlug(locationSlug);
  if (!tool || !loc) {
    return NextResponse.json({ ok: false, error: "Unknown tool or location slug" }, { status: 404 });
  }

  try {
    const payload = await getCachedProgrammaticPayload(toolSlug, locationSlug);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "No payload" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      tool: { slug: tool.slug, name: tool.name, category: tool.category },
      location: { slug: loc.slug, city: loc.city, state: loc.state },
      payload,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
