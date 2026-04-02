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
        "plan,tokens_remaining,tokens_reset_date,role,subscription_status,trial_ends_at,trial_used,full_name,phone,avatar_url,oauth_onboarding_completed"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") throw error;

    const { data: agentRow } = await supabaseServer
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      email: user.email ?? null,
      plan: (data as any)?.plan ?? "free",
      role: (data as any)?.role ?? "user",
      has_agent_record: !!agentRow,
      subscription_status: (data as any)?.subscription_status ?? null,
      trial_ends_at: (data as any)?.trial_ends_at ?? null,
      trial_used: (data as any)?.trial_used ?? false,
      tokens_remaining: (data as any)?.tokens_remaining ?? 10,
      tokens_reset_date: (data as any)?.tokens_reset_date ?? null,
      full_name: (data as any)?.full_name ?? null,
      phone: (data as any)?.phone ?? null,
      avatar_url: (data as any)?.avatar_url ?? null,
      oauth_onboarding_completed: (data as any)?.oauth_onboarding_completed ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

