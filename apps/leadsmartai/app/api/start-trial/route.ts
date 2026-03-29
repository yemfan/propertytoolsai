import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile, error } = await supabaseServer
      .from("user_profiles")
      .select("plan,subscription_status,trial_used,trial_started_at,trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && (error as any).code !== "PGRST116") throw error;

    const status = String((profile as any)?.subscription_status ?? "").toLowerCase();
    const trialUsed = Boolean((profile as any)?.trial_used ?? false);

    if (status === "active" || status === "trialing") {
      return NextResponse.json(
        { ok: false, error: "You already have an active plan/trial." },
        { status: 400 }
      );
    }
    if (trialUsed) {
      return NextResponse.json(
        { ok: false, error: "Trial already used." },
        { status: 400 }
      );
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { error: upsertErr } = await supabaseServer.from("user_profiles").upsert(
      {
        user_id: user.id,
        plan: "pro", // full access during trial
        subscription_status: "trialing",
        trial_used: true,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
      } as any,
      { onConflict: "user_id" }
    );
    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      ok: true,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

