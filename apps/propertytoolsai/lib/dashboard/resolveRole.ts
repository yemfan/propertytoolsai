import { getUserFromRequest } from "@/lib/authFromRequest";
import { parseUserRole, type UserRole } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabaseServer";

export type DashboardActor = { userId: string; role: UserRole };

/** Resolves Supabase auth user + `leadsmart_users.role` for dashboard API routes (Bearer or cookies). */
export async function getDashboardActor(req: Request): Promise<DashboardActor | null> {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const { data } = await supabaseServer
    .from("user_profiles")
    .select("leadsmart_users(role)")
    .eq("user_id", user.id)
    .maybeSingle();
  const row = data as { leadsmart_users?: { role?: string } | { role?: string }[] } | null;
  const lsRaw = row?.leadsmart_users;
  const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
  const dbRole = ls?.role ?? "user";
  return { userId: user.id, role: parseUserRole(dbRole) };
}
