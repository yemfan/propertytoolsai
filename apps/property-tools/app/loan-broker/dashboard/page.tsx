import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function LoanBrokerDashboardPage() {
  const user = await requireRole(["loan_broker", "admin"]);

  return (
    <RbacPageShell
      title="Loan broker dashboard"
      description="Loan broker workspace (from dashboard-router)."
      roleLabel={user.role}
    />
  );
}
