import { NextResponse } from "next/server";
import { markPostcardOpened } from "@/lib/postcards/service";

export const runtime = "nodejs";

/**
 * POST /api/postcard/[slug]/open
 *   Open-tracking beacon. Unauthenticated — the slug is the only
 *   capability. Stamps `opened_at` (first time) + bumps open_count.
 *   Best-effort: failures don't reach the recipient.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    await markPostcardOpened(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("POST /api/postcard/[slug]/open:", err);
    // Return 200 regardless — a failed open beacon shouldn't show
    // an error to the recipient or break the viewer page.
    return NextResponse.json({ ok: true });
  }
}
