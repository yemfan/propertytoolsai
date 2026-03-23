import { redirect } from "next/navigation";
import { ERROR_DASHBOARD_NO_AGENT_ROW, getCurrentAgentContext } from "@/lib/dashboardService";
import { isRedirectError } from "@/lib/isRedirectError";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await (async () => {
    try {
      return await getCurrentAgentContext();
    } catch (e: unknown) {
      if (isRedirectError(e)) throw e;
      const msg = e instanceof Error ? e.message : "";
      if (msg === "Not authenticated") {
        redirect("/login?redirect=/dashboard");
      }
      if (msg === ERROR_DASHBOARD_NO_AGENT_ROW) {
        redirect("/agent-signup?redirect=/dashboard");
      }
      throw e;
    }
  })();

  // Feature gating: dashboard requires active/trialing subscription.
  try {
    const { data } = await supabaseServer
      .from("user_profiles")
      .select("subscription_status,trial_ends_at")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    let status = String((data as any)?.subscription_status ?? "").toLowerCase();
    const trialEndsAt = (data as any)?.trial_ends_at
      ? new Date(String((data as any).trial_ends_at))
      : null;
    if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() <= Date.now()) {
      status = "inactive";
      await supabaseServer
        .from("user_profiles")
        .update({ plan: "free", subscription_status: "inactive" } as any)
        .eq("user_id", ctx.userId);
    }
    if (status && !["active", "trialing"].includes(status)) {
      redirect("/pricing");
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    // If profiles/status isn't available yet, don't block dashboard rendering.
  }

  return <DashboardShell email={ctx?.email}>{children}</DashboardShell>;
}

