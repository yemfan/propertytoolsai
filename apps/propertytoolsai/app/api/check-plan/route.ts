import { NextResponse } from "next/server";
import { resolveAccessTier } from "@/lib/access";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({
        ok: true,
        plan: "free",
        subscription_status: "guest",
        access: "limited",
      });
    }

    const { data: profile, error } = await supabaseServer
      .from("user_profiles")
      .select("plan,subscription_status,trial_ends_at,trial_used,role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && (error as any).code !== "PGRST116") throw error;

    let plan = String((profile as any)?.plan ?? "free");
    let status = String((profile as any)?.subscription_status ?? "inactive").toLowerCase();
    const trialEndsAt = (profile as any)?.trial_ends_at
      ? new Date(String((profile as any).trial_ends_at))
      : null;

    // Auto-end expired trial.
    if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() <= Date.now()) {
      status = "inactive";
      plan = "free";
      await supabaseServer
        .from("user_profiles")
        .update({
          plan: "free",
          subscription_status: "inactive",
        } as any)
        .eq("user_id", user.id);
    }

    const accountRole = (profile as any)?.role ?? null;
    const accessTier = resolveAccessTier({
      userId: user.id,
      plan,
      subscriptionStatus: status,
      accountRole,
    });
    const fullAccess = accessTier === "premium";

    return NextResponse.json({
      ok: true,
      plan,
      subscription_status: status,
      trial_ends_at: trialEndsAt ? trialEndsAt.toISOString() : null,
      trial_used: Boolean((profile as any)?.trial_used ?? false),
      access: fullAccess ? "full" : "limited",
      account_role: accountRole,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

