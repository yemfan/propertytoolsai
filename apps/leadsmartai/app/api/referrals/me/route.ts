import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { getReferralSummary } from "@/lib/referrals/service";

export const runtime = "nodejs";

/**
 * GET /api/referrals/me
 *   Returns the signed-in user's referral code + current bonus
 *   wallet balance + counts of pending / completed referrals.
 *   Generates a code on first call if the user doesn't have one.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not signed in" },
        { status: 401 },
      );
    }
    const summary = await getReferralSummary(user.id);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/referrals/me:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
