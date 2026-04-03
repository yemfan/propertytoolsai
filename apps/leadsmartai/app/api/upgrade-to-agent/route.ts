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

    const admin = supabaseServer;

    const { data: existing } = await admin
      .from("leadsmart_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if ((existing as { role?: string } | null)?.role === "agent") {
      return NextResponse.json({ ok: true, upgraded: false });
    }

    await admin.from("user_profiles").upsert({ user_id: user.id } as never, { onConflict: "user_id" });

    const { data: updated } = await admin
      .from("leadsmart_users")
      .update({ role: "agent" })
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (!(updated as { user_id?: string } | null)?.user_id) {
      const { error: insErr } = await admin.from("leadsmart_users").insert({
        user_id: user.id,
        role: "agent",
      } as never);
      if (insErr) throw insErr;
    }

    const { data: agentRow, error: agentSelectErr } = await admin
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (agentSelectErr && (agentSelectErr as { code?: string }).code !== "PGRST116") throw agentSelectErr;

    if (agentRow?.id) {
      const { error: agentUpdateErr } = await admin
        .from("agents")
        .update({ plan_type: "free" })
        .eq("auth_user_id", user.id);
      if (agentUpdateErr) throw agentUpdateErr;
    } else {
      const { error: agentInsertErr } = await admin.from("agents").insert({
        auth_user_id: user.id,
        plan_type: "free",
      } as Record<string, unknown>);
      if (agentInsertErr) throw agentInsertErr;
    }

    return NextResponse.json({ ok: true, upgraded: true });
  } catch (e: unknown) {
    console.error("POST /api/upgrade-to-agent error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upgrade failed." },
      { status: 500 }
    );
  }
}
