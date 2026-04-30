import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { POSTCARD_TEMPLATES } from "@/lib/postcards/templates";

export const runtime = "nodejs";

/**
 * GET /api/mobile/postcards/templates
 *
 * Returns the static template library so the mobile picker can show
 * each card with its emoji, title, suggestedWhen hint, and default
 * message. Auth'd because this is dashboard-only content even though
 * the templates themselves aren't sensitive.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;
  return NextResponse.json({
    ok: true,
    success: true,
    templates: POSTCARD_TEMPLATES,
  });
}
