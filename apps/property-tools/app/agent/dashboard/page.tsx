import { requireRolePage } from "@/lib/auth/requireRolePage";
import AgentDashboardClient from "./AgentDashboardClient";

export const dynamic = "force-dynamic";

export default async function AgentDashboardPage() {
  await requireRolePage(["agent", "admin"]);

  return <AgentDashboardClient />;
}
