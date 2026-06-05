/**
 * RoleGuard — server component that shows a read-only banner when the
 * current user lacks a specific permission. Used at the top of write pages.
 *
 * Usage (Server Component):
 *   <RoleGuard permission="invoices.write" />
 *   // rest of page form — the form won't be shown if access denied,
 *   // or a banner appears to explain the restriction
 */

import { getMyRole, hasPermission, type Permission } from "@/lib/rbac";
import { Lock } from "lucide-react";

interface Props {
  permission: Permission;
  /** If true, render nothing instead of a banner when access is denied */
  silent?: boolean;
}

export async function RoleGuard({ permission, silent = false }: Props) {
  const role = await getMyRole();
  if (!role || !hasPermission(role, permission)) {
    if (silent) return null;
    return (
      <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Read-only access</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Your role (<span className="font-medium capitalize">{role ?? "unknown"}</span>) does not have permission to make changes here.
            Contact an admin to request access.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Check permission in a server action — returns error payload if denied.
 * Use at the top of write server actions.
 *
 * Usage:
 *   const denied = await checkActionPermission("invoices.write");
 *   if (denied) return denied;
 */
export async function checkActionPermission(
  permission: Permission
): Promise<{ ok: false; error: string } | null> {
  const role = await getMyRole();
  if (!role || !hasPermission(role, permission)) {
    return { ok: false, error: `Permission denied — requires ${permission}` };
  }
  return null;
}
