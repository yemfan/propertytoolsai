import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await requireRole(["support", "admin"]);

  return (
    <RbacPageShell
      title="Support workspace"
      description="Customer support tools and queues. Restrict to support + admin roles."
      roleLabel={user.role}
    >
      <p className="text-sm text-slate-700">
        Add support tickets, impersonation (if permitted), and CRM links in this section.
      </p>
    </RbacPageShell>
  );
}
