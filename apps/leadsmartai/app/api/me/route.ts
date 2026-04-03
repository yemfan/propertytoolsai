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
        "full_name,phone,avatar_url,email,leadsmart_users(plan,tokens_remaining,tokens_reset_date,role,subscription_status,trial_ends_at,trial_used,oauth_onboarding_completed)"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") throw error;

    const rawLs = (data as { leadsmart_users?: Record<string, unknown> | Record<string, unknown>[] | null } | null)
      ?.leadsmart_users;
    const ls = rawLs == null ? null : Array.isArray(rawLs) ? rawLs[0] : rawLs;

    const { data: agentRow } = await supabaseServer
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      email: user.email ?? null,
      plan: (ls?.plan as string | undefined) ?? "free",
      role: (ls?.role as string | undefined) ?? "user",
      has_agent_record: !!agentRow,
      subscription_status: (ls?.subscription_status as string | null | undefined) ?? null,
      trial_ends_at: (ls?.trial_ends_at as string | null | undefined) ?? null,
      trial_used: Boolean(ls?.trial_used ?? false),
      tokens_remaining: (ls?.tokens_remaining as number | undefined) ?? 10,
      tokens_reset_date: (ls?.tokens_reset_date as string | null | undefined) ?? null,
      full_name: (data as { full_name?: string | null } | null)?.full_name ?? null,
      phone: (data as { phone?: string | null } | null)?.phone ?? null,
      avatar_url: (data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      oauth_onboarding_completed: (ls?.oauth_onboarding_completed as boolean | null | undefined) ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

