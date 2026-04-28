import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getSelectedSalesModelServer } from "@/lib/sales-model-server";
import { loadActivitySnapshot } from "@/lib/sales-model/pipelineActivity.server";
import { SalesModelDashboard } from "@/components/sales-model/SalesModelDashboard";

export const metadata: Metadata = {
  title: "Sales Model",
  description:
    "Your personalized dashboard, scripts, tasks, and pipeline based on the sales model you've chosen.",
  robots: { index: false },
};

/**
 * Sales Model dashboard. Server component:
 *   - Resolves the agent's selection from Supabase.
 *   - Bounces to onboarding when nothing is set yet — that's the
 *     first-run experience, not an error state.
 *   - Hands the resolved id to the client wrapper. The wrapper owns
 *     the switch-model flow + every section render.
 */
export default async function SalesModelPage() {
  const { userId } = await getCurrentAgentContext();
  const selected = await getSelectedSalesModelServer(userId);
  if (!selected) {
    redirect("/dashboard/sales-model/onboarding");
  }
  const activitySnapshot = await loadActivitySnapshot(userId);
  return (
    <SalesModelDashboard
      initialModelId={selected}
      activitySnapshot={activitySnapshot}
    />
  );
}
