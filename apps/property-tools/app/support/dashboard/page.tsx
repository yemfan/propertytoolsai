import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function SupportDashboardPage() {
  const user = await requireRole(["support", "admin"]);

  return (
    <RbacPageShell
      title="Support dashboard"
      description="Support workspace (from dashboard-router)."
      roleLabel={user.role}
    />
  );
}
