import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { listMediaForAgent, type MediaKind } from "@/lib/leads-gen/media";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/media/list?kind=<MediaKind>&limit=<n>
 *
 * Lists the agent's media library, newest first. Each item carries
 * a fresh 1h signed read URL so the wizard can preview without
 * another round-trip per image.
 *
 * Both params optional. `limit` clamped to [1, 200] in the helper.
 */
export async function GET(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Media library requires Pro or higher." },
        { status: 402 },
      );
    }

    const url = new URL(req.url);
    const kindRaw = (url.searchParams.get("kind") ?? "").trim();
    const limitRaw = url.searchParams.get("limit");

    const kind: MediaKind | null =
      kindRaw === "general" ||
      kindRaw === "listing_photo" ||
      kindRaw === "agent_headshot" ||
      kindRaw === "agent_logo" ||
      kindRaw === "market_chart" ||
      kindRaw === "testimonial_quote"
        ? (kindRaw as MediaKind)
        : null;
    const limit = limitRaw ? Number(limitRaw) : 100;

    const items = await listMediaForAgent(auth.agentId, {
      kind,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load library";
    console.error("[leads-gen/media/list]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
