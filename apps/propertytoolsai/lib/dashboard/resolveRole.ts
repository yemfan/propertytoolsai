import { getUserFromRequest } from "@/lib/authFromRequest";
import { parseUserRole, type UserRole } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabaseServer";

export type DashboardActor = { userId: string; role: UserRole };

/** Resolves Supabase auth user + `profiles.role` for dashboard API routes (Bearer or cookies). */
export async function getDashboardActor(req: Request): Promise<DashboardActor | null> {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const { data } = await supabaseServer.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { userId: user.id, role: parseUserRole(data?.role as string) };
}
