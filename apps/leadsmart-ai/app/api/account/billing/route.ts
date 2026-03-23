import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import type { InternalPlan } from "@/lib/billing/stripe-plan-map";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Current subscription snapshot for the signed-in user (from `billing_subscriptions`, Stripe-synced).
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      billing: row
        ? {
            plan: row.plan as InternalPlan,
            status: row.status,
          }
        : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Failed to load billing" },
      { status: 500 }
    );
  }
}
