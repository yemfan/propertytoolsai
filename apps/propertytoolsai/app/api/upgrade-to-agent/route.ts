import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabaseAuth = supabaseServerClient();
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    let user = userData?.user ?? null;

    if (!user || userErr) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (token) {
        const { data: tokenUserData, error: tokenUserErr } =
          await supabaseAuth.auth.getUser(token);
        if (!tokenUserErr && tokenUserData?.user) {
          user = tokenUserData.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!user.email) {
      return NextResponse.json(
        { error: "Your account is missing an email address. Please re-login and try again." },
        { status: 400 }
      );
    }

    const supabaseAdmin = supabaseServer;

    const { data: lsRow, error: lsErr } = await supabaseAdmin
      .from("leadsmart_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lsErr && (lsErr as { code?: string }).code !== "PGRST116") throw lsErr;

    const currentRole = String(lsRow?.role ?? "").toLowerCase();
    if (currentRole === "agent") {
      return NextResponse.json({ ok: true, upgraded: false });
    }

    const { error: upErr } = await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: user.id, email: user.email }, { onConflict: "user_id" });
    if (upErr) throw upErr;

    const now = new Date().toISOString();
    if (lsRow) {
      const { error: roleErr } = await supabaseAdmin
        .from("leadsmart_users")
        .update({ role: "agent", updated_at: now })
        .eq("user_id", user.id);
      if (roleErr) throw roleErr;
    } else {
      const { error: insErr } = await supabaseAdmin.from("leadsmart_users").insert({
        user_id: user.id,
        role: "agent",
        plan: "free",
        tokens_remaining: 10,
        tokens_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      });
      if (insErr) throw insErr;
    }

    const { data: agentRow, error: agentSelectErr } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (agentSelectErr && (agentSelectErr as { code?: string }).code !== "PGRST116") {
      throw agentSelectErr;
    }

    if (agentRow?.id) {
      const { error: agentUpdateErr } = await supabaseAdmin
        .from("agents")
        .update({ plan_type: "free" })
        .eq("auth_user_id", user.id);
      if (agentUpdateErr) throw agentUpdateErr;
    } else {
      const { error: agentInsertErr } = await supabaseAdmin.from("agents").insert({
        auth_user_id: user.id,
        plan_type: "free",
      } as Record<string, unknown>);
      if (agentInsertErr) throw agentInsertErr;
    }

    return NextResponse.json({ ok: true, upgraded: true });
  } catch (e: unknown) {
    console.error("POST /api/upgrade-to-agent error", e);
    const msg = e instanceof Error ? e.message : "Upgrade failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
