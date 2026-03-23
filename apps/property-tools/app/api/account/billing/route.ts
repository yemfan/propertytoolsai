import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rowToBillingRecord } from "@/lib/billingAccountRecord";

export const dynamic = "force-dynamic";

/**
 * Latest `billing_subscriptions` row for the signed-in user (by `user_id`).
 * Uses service role for reads; access is scoped by `user.id` from the session.
 */
export async function GET() {
  try {
    const user = await getCurrentUserWithRole();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ success: true, billing: null });
    }

    return NextResponse.json({
      success: true,
      billing: rowToBillingRecord(data as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[account/billing]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load account billing" },
      { status: 500 }
    );
  }
}
