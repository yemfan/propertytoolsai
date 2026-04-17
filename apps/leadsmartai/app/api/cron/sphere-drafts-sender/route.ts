import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { dispatchApprovedDrafts } from "@/lib/drafts/sender";

export const runtime = "nodejs";

/**
 * Dispatch approved Sphere/message drafts to Twilio or Resend.
 * Respects spec §2.8 guardrails (quiet hours, per-contact caps, Sunday AM,
 * Chinese New Year pause, DNC flags).
 *
 * Invoked by Vercel Cron every 15 minutes during the agent-local day.
 * Manual run: `curl "$SITE/api/cron/sphere-drafts-sender?secret=$CRON_SECRET"`.
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const result = await dispatchApprovedDrafts({
      agentId,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("cron/sphere-drafts-sender", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
