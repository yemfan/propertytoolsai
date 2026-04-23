import { NextResponse } from "next/server";
import { getPublicFeedbackBySlug } from "@/lib/listing-feedback/publicService";

export const runtime = "nodejs";
// Short TTL. If the listing agent cancels / deletes, we want the form
// to 404 quickly.
export const revalidate = 30;

/**
 * GET /api/public/listing-feedback/[slug]
 *   Returns the public-safe info needed to render the form. No agent
 *   emails, no internal ids.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const info = await getPublicFeedbackBySlug(slug);
    if (!info) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, feedback: info });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET public listing-feedback:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
