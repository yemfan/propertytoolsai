import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * True when `user_profiles.role` is `admin` (case-insensitive).
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  const r = String((data as { role?: string }).role ?? "").toLowerCase().trim();
  return r === "admin";
}

/** Use in API routes after resolving the authenticated user id. */
export async function requireAdminApi(userId: string): Promise<NextResponse | null> {
  if (!(await isUserAdmin(userId))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}
