import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function AgentWorkspacePage() {
  const user = await requireRole(["agent", "admin"]);

  return (
    <RbacPageShell
      title="Agent workspace"
      description="Professional real estate tooling. Agents and admins can access this area."
      roleLabel={user.role}
    >
      <p className="text-sm text-slate-700">
        Connect your CRM, lead routing, and premium calculators here.
      </p>
    </RbacPageShell>
  );
}
