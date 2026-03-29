import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const isMissingUserIdColumn = (err: any) => {
      const msg = String(err?.message ?? "");
      return (
        /user_id.*does not exist/i.test(msg) ||
        /column\s+.*user_id.*does not exist/i.test(msg)
      );
    };

    // 1) Auth required: verify the current logged-in user.
    const supabaseAuth = supabaseServerClient();
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    let user = userData?.user ?? null;

    // Fallback: some auth sessions are client-side; accept a bearer token.
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

    // 2) Idempotent upgrade: if already an agent, return success.
    // Use `public.user_profiles` (dedicated profile table) instead of `public.users`.
    const supabaseAdmin = supabaseServer;
    let userIdColumn: "user_id" | "id" = "user_id";

    let userRow: any = null;
    let roleErr: any = null;
    try {
      ({ data: userRow, error: roleErr } = await supabaseAdmin
        .from("user_profiles")
        .select("role")
        .eq(userIdColumn, user.id)
        .maybeSingle());
    } catch (e: any) {
      if (userIdColumn === "user_id" && isMissingUserIdColumn(e)) {
        userIdColumn = "id";
        // `user_profiles` always uses `user_id`
        ({ data: userRow, error: roleErr } = await supabaseAdmin
          .from("user_profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle());
      } else {
        throw e;
      }
    }

    if (roleErr && (roleErr as any).code !== "PGRST116") throw roleErr;

    const currentRole = (userRow as any)?.role as string | null;
    if (currentRole === "agent") {
      return NextResponse.json({ ok: true, upgraded: false });
    }

    // 3) Update role to "agent" (update first; insert if missing).
    let updatedUser: any = null;
    let updateUserErr: any = null;
    try {
      ({ data: updatedUser, error: updateUserErr } = await supabaseAdmin
        .from("user_profiles")
        .update({ role: "agent" })
        .eq("user_id", user.id)
        .select("user_id")
        .maybeSingle());
    } catch (e: any) {
      if (userIdColumn === "user_id" && isMissingUserIdColumn(e)) {
        ({ data: updatedUser, error: updateUserErr } = await supabaseAdmin
          .from("user_profiles")
          .update({ role: "agent" })
          .eq("user_id", user.id)
          .select("user_id")
          .maybeSingle());
      } else {
        throw e;
      }
    }

    if (updateUserErr) throw updateUserErr;

    if (!(updatedUser as any)?.user_id) {
      const insertPayload: any = { role: "agent", user_id: user.id };

      const { error: insertUserErr } = await supabaseAdmin
        .from("user_profiles")
        .insert(insertPayload);
      if (insertUserErr) throw insertUserErr;
    }

    // 4) Ensure an `agents` row exists for API routes that scope by agent id.
    const { data: agentRow, error: agentSelectErr } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (agentSelectErr && (agentSelectErr as any).code !== "PGRST116") throw agentSelectErr;

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
      } as any);
      if (agentInsertErr) throw agentInsertErr;
    }

    return NextResponse.json({ ok: true, upgraded: true });
  } catch (e: any) {
    console.error("POST /api/upgrade-to-agent error", e);
    return NextResponse.json(
      { error: e?.message ?? "Upgrade failed." },
      { status: 500 }
    );
  }
}

