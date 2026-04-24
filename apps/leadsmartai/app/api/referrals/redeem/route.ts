import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { recordPendingReferral } from "@/lib/referrals/service";

export const runtime = "nodejs";

/**
 * POST /api/referrals/redeem
 *   Body: { code: string }
 *   Called right after a new user signs up with `?ref=CODE` in the
 *   URL. Creates a `pending` referral row linking them to the
 *   referrer. The actual bonus grant happens later when the user
 *   completes onboarding — see lib/entitlements/ensureStarterEntitlement.
 *
 *   Idempotent: second call for the same referee is a no-op.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not signed in" },
        { status: 401 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "code is required" },
        { status: 400 },
      );
    }
    const result = await recordPendingReferral({
      refereeUserId: user.id,
      code,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/referrals/redeem:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
