import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { PLANS } from "@/lib/billing/plans";
import {
  billingPageAbsoluteUrl,
  getCrmSubscriptionSnapshot,
} from "@/lib/billing/subscriptionAccess";

export const runtime = "nodejs";

/**
 * Current user’s active CRM subscription + feature list (for dashboard / mobile shell).
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getCrmSubscriptionSnapshot(user.id);

    return NextResponse.json({
      ok: true,
      subscription,
      catalog: PLANS,
      billingPageUrl: billingPageAbsoluteUrl(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/billing/subscription", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
