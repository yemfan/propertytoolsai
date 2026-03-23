import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

/** Only `user_profiles.role === 'admin'` may access admin billing APIs. */
export async function requireAdminFromRequest(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return null;

  const { data, error } = await supabaseServer
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && (error as { code?: string }).code !== "PGRST116") {
    throw new Error(error.message);
  }

  const r = String((data as { role?: string } | null)?.role ?? "").toLowerCase().trim();
  if (r !== "admin") return null;

  return user;
}
