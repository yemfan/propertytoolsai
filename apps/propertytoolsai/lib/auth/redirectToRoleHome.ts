import { redirect } from "next/navigation";
import type { UserRole } from "./roles";
import { getRoleHomePath } from "./roles";

/**
 * Server-only: send the user to their role dashboard (or consumer hub).
 * Use when a signed-in user hits a route their RBAC role may not access.
 */
export function redirectToRoleHome(role: UserRole): never {
  redirect(getRoleHomePath(role));
}
