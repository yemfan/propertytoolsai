import { NextResponse } from "next/server";
import { getPublicOpenHouseBySlug } from "@/lib/open-houses/publicService";

export const runtime = "nodejs";
// Short TTL: slug info is stable for the life of the event, but we
// want cancellations to propagate quickly. 30s is a fine balance.
export const revalidate = 30;

/**
 * GET /api/public/open-house/[slug]
 *
 * Unauthenticated — returns the minimum info the sign-in page needs
 * to render. Never exposes agent email, phone, or internal ids.
 *
 * 404 for unknown slug AND for cancelled events (so an old QR code
 * can't be used after the agent pulls it).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const info = await getPublicOpenHouseBySlug(slug);
    if (!info || info.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, openHouse: info });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET public open-house:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
