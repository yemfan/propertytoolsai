import { requireRolePage } from "@/lib/auth/requireRolePage";
import { LoanBrokerDashboardClient } from "./LoanBrokerDashboardClient";

export const dynamic = "force-dynamic";

export default async function LoanBrokerDashboardPage() {
  await requireRolePage(["loan_broker", "admin"]);

  return <LoanBrokerDashboardClient />;
}
