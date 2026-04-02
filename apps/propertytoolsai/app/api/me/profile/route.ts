import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin, isSupabaseServiceConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  full_name?: string;
  phone?: string;
};

/**
 * PATCH /api/me/profile — update `user_profiles` fields for the signed-in user.
 * Does not update `role`; role is system-assigned via `user_profiles.role` only.
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

  const updates: Record<string, string> = {};
  if (typeof body.full_name === "string") {
    updates.full_name = body.full_name.trim();
  }
  if (typeof body.phone === "string") {
    updates.phone = body.phone.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("user_profiles")
    .update(updates as never)
    .eq("user_id", user.id)
    .select("user_id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!updated?.length) {
    const { error: insErr } = await supabaseAdmin.from("user_profiles").insert({
      user_id: user.id,
      role: "user",
      ...updates,
    } as never);
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
