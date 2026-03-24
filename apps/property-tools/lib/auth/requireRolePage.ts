import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import type { AppRole, CurrentUserWithRole } from "@/lib/auth/getCurrentUserRole";
import { redirectToRoleHome } from "@/lib/auth/redirectToRoleHome";

/**
 * Server Components / layouts: require Supabase session + `profiles.role`.
 * - Unauthenticated → `/login`
 * - Wrong role → role home (`admin` may access any staff dashboard when listed in `allowed`)
 */
export async function requireRolePage(allowed: AppRole[]): Promise<CurrentUserWithRole> {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login");
  }

  if (!allowed.includes(user.role)) {
    redirectToRoleHome(user.role);
  }

  return user;
}
