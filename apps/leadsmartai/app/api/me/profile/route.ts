import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin, isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import { formatUsPhoneStored, isValidUsPhone } from "@/lib/usPhone";

export const runtime = "nodejs";

const ONBOARDING_ROLES = new Set(["user", "agent", "broker", "support"]);

type Body = {
  full_name?: string;
  phone?: string;
  role?: string;
  /** Set true when finishing Google/Apple onboarding or email signup form */
  oauth_onboarding_completed?: boolean;
};

/**
 * PATCH /api/me/profile — shared fields on `user_profiles`; LeadSmart fields on `leadsmart_users`.
 */
export async function PATCH(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const sharedUpdates: Record<string, string> = {};
  const lsUpdates: Record<string, string | boolean> = {};

  if (typeof body.full_name === "string") {
    sharedUpdates.full_name = body.full_name.trim();
  }
  if (typeof body.phone === "string") {
    const raw = body.phone.trim();
    if (!raw) {
      sharedUpdates.phone = "";
    } else if (!isValidUsPhone(raw)) {
      return NextResponse.json(
        { ok: false, error: "Phone must be a valid US number (10 digits)." },
        { status: 400 }
      );
    } else {
      const formatted = formatUsPhoneStored(raw);
      if (!formatted) {
        return NextResponse.json(
          { ok: false, error: "Phone must be a valid US number (10 digits)." },
          { status: 400 }
        );
      }
      sharedUpdates.phone = formatted;
    }
  }
  if (typeof body.role === "string") {
    const r = body.role.trim().toLowerCase();
    if (!ONBOARDING_ROLES.has(r)) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
    }
    lsUpdates.role = r;
  }
  if (typeof body.oauth_onboarding_completed === "boolean") {
    lsUpdates.oauth_onboarding_completed = body.oauth_onboarding_completed;
  }

  if (Object.keys(sharedUpdates).length === 0 && Object.keys(lsUpdates).length === 0) {
    return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
  }

  if (Object.keys(sharedUpdates).length > 0) {
    const { data: up, error } = await supabaseAdmin
      .from("user_profiles")
      .update(sharedUpdates as never)
      .eq("user_id", user.id)
      .select("user_id");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!up?.length) {
      const { error: insErr } = await supabaseAdmin.from("user_profiles").insert({
        user_id: user.id,
        ...sharedUpdates,
      } as never);
      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }
    }
  }

  if (Object.keys(lsUpdates).length > 0) {
    const { data: ls, error } = await supabaseAdmin
      .from("leadsmart_users")
      .update(lsUpdates as never)
      .eq("user_id", user.id)
      .select("user_id");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!ls?.length) {
      const insertRow: Record<string, unknown> = {
        user_id: user.id,
        role: typeof lsUpdates.role === "string" ? lsUpdates.role : "user",
        ...lsUpdates,
      };
      if (typeof insertRow.role !== "string" || !insertRow.role) insertRow.role = "user";
      const { error: insErr } = await supabaseAdmin.from("leadsmart_users").insert(insertRow as never);
      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
