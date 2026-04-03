import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: lsRow, error } = await supabaseServer
      .from("leadsmart_users")
      .select("plan,subscription_status,trial_used,trial_started_at,trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && (error as { code?: string }).code !== "PGRST116") throw error;

    const status = String(lsRow?.subscription_status ?? "").toLowerCase();
    const trialUsed = Boolean(lsRow?.trial_used ?? false);

    if (status === "active" || status === "trialing") {
      return NextResponse.json(
        { ok: false, error: "You already have an active plan/trial." },
        { status: 400 }
      );
    }
    if (trialUsed) {
      return NextResponse.json({ ok: false, error: "Trial already used." }, { status: 400 });
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const payload = {
      plan: "pro",
      subscription_status: "trialing",
      trial_used: true,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      updated_at: now.toISOString(),
    };

    if (lsRow) {
      const { error: upErr } = await supabaseServer
        .from("leadsmart_users")
        .update(payload)
        .eq("user_id", user.id);
      if (upErr) throw upErr;
    } else {
      const { error: upProf } = await supabaseServer
        .from("user_profiles")
        .upsert({ user_id: user.id }, { onConflict: "user_id" });
      if (upProf) throw upProf;

      const { error: insErr } = await supabaseServer.from("leadsmart_users").insert({
        user_id: user.id,
        role: "user",
        ...payload,
        tokens_remaining: 10,
        tokens_reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      });
      if (insErr) throw insErr;
    }

    return NextResponse.json({
      ok: true,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
