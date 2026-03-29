import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole(["admin"]);

  return (
    <RbacPageShell
      title="Admin console"
      description="Full access to internal tooling. Wire your admin dashboards and APIs here."
      roleLabel={user.role}
    >
      <ul className="list-inside list-disc space-y-2 text-sm text-slate-700">
        <li>Use this route as the entry point for admin-only server actions and pages.</li>
        <li>Enforce role checks with <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">requireRole([&apos;admin&apos;])</code>.</li>
      </ul>
    </RbacPageShell>
  );
}
