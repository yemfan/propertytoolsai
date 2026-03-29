import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

export default async function LoanBrokerPage() {
  const user = await requireRole(["loan_broker", "admin"]);

  return (
    <RbacPageShell
      title="Loan broker workspace"
      description="Mortgage and lending workflows for loan brokers (and admins)."
      roleLabel={user.role}
    >
      <p className="text-sm text-slate-700">
        Add rate scenarios, partner links, and lender-specific resources here.
      </p>
    </RbacPageShell>
  );
}
