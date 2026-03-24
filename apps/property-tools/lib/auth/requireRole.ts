import { redirect } from "next/navigation";
import { getCurrentUserWithRole, type AppRole } from "@/lib/auth/getCurrentUser";

/**
 * Requires session + role; wrong role → `/unauthorized`.
 * For dashboard routes prefer {@link requireRolePage} (redirects to the user’s role home).
 */
export async function requireRole(allowed: AppRole[]) {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login");
  }

  if (!allowed.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}
