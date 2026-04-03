import { redirect } from "next/navigation";
import { ERROR_DASHBOARD_NO_AGENT_ROW } from "@leadsmart/shared";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { isRedirectError } from "@/lib/isRedirectError";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { AgentWorkspaceProviders } from "@/components/entitlements/AgentWorkspaceProviders";
import { ADMIN_SUPPORT_HOME_PATH, isAdminOrSupportRole } from "@/lib/rolePortalPaths";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

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
        const supabase = supabaseServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: ls } = await supabaseServer
            .from("leadsmart_users")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();
          const roleRaw = (ls as { role?: string } | null)?.role;
          if (isAdminOrSupportRole(roleRaw)) {
            redirect(ADMIN_SUPPORT_HOME_PATH);
          }
        }
        redirect("/agent-signup?redirect=/dashboard");
      }
      throw e;
    }
  })();

  let appRole: string | null = null;

  // Feature gating: dashboard requires active/trialing subscription.
  try {
    const { data } = await supabaseServer
      .from("leadsmart_users")
      .select("subscription_status,trial_ends_at,role")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const roleRaw = (data as { role?: string } | null)?.role;
    appRole = typeof roleRaw === "string" && roleRaw.trim() ? roleRaw.trim() : null;
    const staff = isAdminOrSupportRole(appRole);
    let status = String((data as any)?.subscription_status ?? "").toLowerCase();
    const trialEndsAt = (data as any)?.trial_ends_at
      ? new Date(String((data as any).trial_ends_at))
      : null;
    if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() <= Date.now()) {
      status = "inactive";
      await supabaseServer
        .from("leadsmart_users")
        .update({ plan: "free", subscription_status: "inactive" } as Record<string, unknown>)
        .eq("user_id", ctx.userId);
    }
    if (!staff && status && !["active", "trialing"].includes(status)) {
      redirect("/agent/pricing");
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    // If profiles/status isn't available yet, don't block dashboard rendering.
  }

  return (
    <AgentWorkspaceProviders>
      <DashboardShell email={ctx?.email} appRole={appRole}>
        {children}
      </DashboardShell>
    </AgentWorkspaceProviders>
  );
}

