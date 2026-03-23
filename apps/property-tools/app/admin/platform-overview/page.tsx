import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function AdminPlatformOverviewPage() {
  const user = await requireRole(["admin"]);

  return (
    <RbacPageShell
      title="Platform overview"
      description="Admin dashboard entry point (from dashboard-router)."
      roleLabel={user.role}
    >
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800">Quick links</p>
        <Link
          href="/admin/users"
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-[#0072ce]/40 hover:bg-white"
        >
          <span>User management</span>
          <span className="text-slate-400" aria-hidden>
            →
          </span>
        </Link>
        <p className="text-xs text-slate-500">
          Invite staff, change roles, and activate or deactivate accounts.
        </p>
      </div>
    </RbacPageShell>
  );
}
