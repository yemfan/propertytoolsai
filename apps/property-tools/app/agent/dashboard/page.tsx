import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function AgentDashboardPage() {
  const user = await requireRole(["agent", "admin"]);

  return (
    <RbacPageShell
      title="Agent dashboard"
      description="Agent workspace (from dashboard-router)."
      roleLabel={user.role}
    />
  );
}
