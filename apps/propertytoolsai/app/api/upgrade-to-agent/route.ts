import { NextResponse } from "next/server";
import {
  mirrorUserProfileContact,
  toE164Us,
  isValidUsPhone,
  userMetadataWithFullNameOnly,
} from "@/lib/auth/canonicalUserContact";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";

type UpgradeBody = {
  full_name?: string;
  phone?: string;
};

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

    let body: UpgradeBody = {};
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        body = (await req.json()) as UpgradeBody;
      }
    } catch {
      body = {};
    }

    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required to complete agent setup." },
        { status: 400 }
      );
    }
    if (!phoneRaw || !isValidUsPhone(phoneRaw)) {
      return NextResponse.json(
        { error: "A valid US phone number (10 digits) is required to complete agent setup." },
        { status: 400 }
      );
    }
    const e164 = toE164Us(phoneRaw.replace(/\D/g, ""));
    if (!e164) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    const supabaseAdmin = supabaseServer;

    const { data: existingAuth, error: authGetErr } = await supabaseAdmin.auth.admin.getUserById(
      user.id
    );
    if (authGetErr || !existingAuth?.user) {
      return NextResponse.json({ error: "Could not load account." }, { status: 500 });
    }

    const meta = userMetadataWithFullNameOnly(
      (existingAuth.user.user_metadata as Record<string, unknown>) ?? {},
      fullName
    );

    const { error: authUpErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: user.email.trim(),
      phone: e164,
      user_metadata: meta,
    });
    if (authUpErr) {
      return NextResponse.json(
        { error: authUpErr.message || "Could not update your profile." },
        { status: 400 }
      );
    }

    try {
      await mirrorUserProfileContact(supabaseAdmin, {
        userId: user.id,
        email: user.email.trim(),
        phone: e164,
        fullName,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sync profile.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

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
