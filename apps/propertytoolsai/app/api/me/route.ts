import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ plan: "guest", tokens_remaining: null });
    }

    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select(
        "full_name,phone,avatar_url,email,leadsmart_users(plan,tokens_remaining,tokens_reset_date,role,subscription_status,trial_ends_at,trial_used,oauth_onboarding_completed),propertytools_users(tier)"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && (error as { code?: string }).code !== "PGRST116") throw error;

    const row = data as {
      full_name?: string | null;
      phone?: string | null;
      email?: string | null;
      avatar_url?: string | null;
      leadsmart_users?: Record<string, unknown> | Record<string, unknown>[] | null;
      propertytools_users?: { tier?: string } | { tier?: string }[] | null;
    } | null;

    const lsRaw = row?.leadsmart_users;
    const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
    const ptRaw = row?.propertytools_users;
    const pt = ptRaw == null ? null : Array.isArray(ptRaw) ? ptRaw[0] : ptRaw;

    const rawRole = String(ls?.role ?? "").toLowerCase().trim();
    const roleForApi =
      rawRole === "user" || rawRole === "" ? "consumer" : String(ls?.role ?? "user");

    const { data: agentRow } = await supabaseServer
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const profileEmail = row?.email?.trim() || null;

    return NextResponse.json({
      email: profileEmail || user.email || null,
      plan: String(ls?.plan ?? "free"),
      role: roleForApi,
      propertytools_tier: pt?.tier ?? null,
      has_agent_record: !!agentRow,
      subscription_status: ls?.subscription_status != null ? String(ls.subscription_status) : null,
      trial_ends_at: ls?.trial_ends_at ?? null,
      trial_used: Boolean(ls?.trial_used ?? false),
      tokens_remaining: Number(ls?.tokens_remaining ?? 10),
      tokens_reset_date: ls?.tokens_reset_date ?? null,
      full_name: row?.full_name ?? null,
      phone: row?.phone ?? null,
      avatar_url: row?.avatar_url ?? null,
      oauth_onboarding_completed: ls?.oauth_onboarding_completed ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
