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
      .select("plan,tokens_remaining,tokens_reset_date,role,subscription_status,trial_ends_at,trial_used")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") throw error;

    return NextResponse.json({
      plan: (data as any)?.plan ?? "free",
      role: (data as any)?.role ?? "user",
      subscription_status: (data as any)?.subscription_status ?? null,
      trial_ends_at: (data as any)?.trial_ends_at ?? null,
      trial_used: (data as any)?.trial_used ?? false,
      tokens_remaining: (data as any)?.tokens_remaining ?? 10,
      tokens_reset_date: (data as any)?.tokens_reset_date ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

