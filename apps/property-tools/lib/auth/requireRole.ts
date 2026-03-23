import { redirect } from "next/navigation";
import { getCurrentUserWithRole, type AppRole } from "@/lib/auth/getCurrentUser";

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
