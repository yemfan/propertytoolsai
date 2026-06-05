/**
 * Role-Based Access Control (RBAC)
 *
 * Roles defined in organization_members:
 *   owner      — full access, cannot be removed
 *   admin      — full access except billing/org-delete
 *   bookkeeper — financial read/write; no team/settings
 *   viewer     — read-only across all modules
 *
 * Permission matrix:
 *   PERMISSION                  owner  admin  bookkeeper  viewer
 *   ─────────────────────────── ─────  ─────  ──────────  ──────
 *   settings.read               ✓      ✓      ✗           ✗
 *   settings.write              ✓      ✓      ✗           ✗
 *   team.manage                 ✓      ✓      ✗           ✗
 *   clients.write               ✓      ✓      ✗           ✗
 *   clients.read                ✓      ✓      ✓           ✓
 *   invoices.write              ✓      ✓      ✓           ✗
 *   invoices.read               ✓      ✓      ✓           ✓
 *   books.write                 ✓      ✓      ✓           ✗
 *   books.read                  ✓      ✓      ✓           ✓
 *   pipeline.write              ✓      ✓      ✗           ✗
 *   pipeline.read               ✓      ✓      ✓           ✓
 *   forms.write                 ✓      ✓      ✗           ✗
 *   campaigns.write             ✓      ✓      ✗           ✗
 *   reports.read                ✓      ✓      ✓           ✓
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type OrgRole = "owner" | "admin" | "bookkeeper" | "viewer";

export type Permission =
  | "settings.read"
  | "settings.write"
  | "team.manage"
  | "clients.write"
  | "clients.read"
  | "invoices.write"
  | "invoices.read"
  | "books.write"
  | "books.read"
  | "pipeline.write"
  | "pipeline.read"
  | "forms.write"
  | "campaigns.write"
  | "reports.read";

const ROLE_PERMISSIONS: Record<OrgRole, Set<Permission>> = {
  owner: new Set([
    "settings.read", "settings.write", "team.manage",
    "clients.write", "clients.read",
    "invoices.write", "invoices.read",
    "books.write", "books.read",
    "pipeline.write", "pipeline.read",
    "forms.write", "campaigns.write",
    "reports.read",
  ]),
  admin: new Set([
    "settings.read", "settings.write", "team.manage",
    "clients.write", "clients.read",
    "invoices.write", "invoices.read",
    "books.write", "books.read",
    "pipeline.write", "pipeline.read",
    "forms.write", "campaigns.write",
    "reports.read",
  ]),
  bookkeeper: new Set([
    "clients.read",
    "invoices.write", "invoices.read",
    "books.write", "books.read",
    "pipeline.read",
    "reports.read",
  ]),
  viewer: new Set([
    "clients.read",
    "invoices.read",
    "books.read",
    "pipeline.read",
    "reports.read",
  ]),
};

/**
 * Check if a role has a specific permission.
 * Pure utility — no DB call needed.
 */
export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Get the current user's role in the active org.
 * Returns null if not authenticated or not a member.
 */
export async function getMyRole(): Promise<OrgRole | null> {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("helmsmart-org-id")?.value;
    if (!orgId) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    return (membership?.role as OrgRole) ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side permission guard for page components.
 * Call at the top of a Server Component — redirects if access is denied.
 *
 * Usage:
 *   await requirePermission("settings.write")
 */
export async function requirePermission(
  permission: Permission,
  redirectTo = "/home"
): Promise<OrgRole> {
  const role = await getMyRole();
  if (!role || !hasPermission(role, permission)) {
    redirect(redirectTo);
  }
  return role;
}

/**
 * Server-side role guard — redirects if the user's role isn't in the allowed list.
 */
export async function requireRole(
  allowedRoles: OrgRole[],
  redirectTo = "/home"
): Promise<OrgRole> {
  const role = await getMyRole();
  if (!role || !allowedRoles.includes(role)) {
    redirect(redirectTo);
  }
  return role;
}
