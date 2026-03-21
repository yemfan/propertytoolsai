import { redirect } from "next/navigation";
import { isUserAdmin } from "@/lib/adminRole";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import RevenueDashboardClient from "@/components/dashboard/RevenueDashboardClient";

export default async function RevenueDashboardPage() {
  let ctx;
  try {
    ctx = await getCurrentAgentContext();
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      redirect("/login?redirect=/dashboard/revenue");
    }
    throw e;
  }
  if (!(await isUserAdmin(ctx.userId))) {
    redirect("/dashboard/overview");
  }
  return <RevenueDashboardClient />;
}
