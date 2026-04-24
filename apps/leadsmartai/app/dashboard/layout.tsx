import { redirect } from "next/navigation";
import { ERROR_DASHBOARD_NO_AGENT_ROW } from "@leadsmart/shared";
import { ensureStarterEntitlement } from "@/lib/entitlements/ensureStarterEntitlement";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { isRedirectError } from "@/lib/isRedirectError";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { AgentWorkspaceProviders } from "@/components/entitlements/AgentWorkspaceProviders";
import { ADMIN_SUPPORT_HOME_PATH, isAdminOrSupportRole } from "@/lib/rolePortalPaths";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { UpgradeBanner } from "@/components/upsell/UpgradeBanner";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { AiChatPanel } from "@/components/dashboard/AiChatPanel";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CommandPalette } from "@/components/ui/CommandPalette";

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
      // Inactive-sub flow:
      //   1. Auto-assign the Starter (free) entitlement. No paying
      //      user ever expects to lose access entirely — they
      //      should just fall to the free tier and keep using the
      //      app. ensureStarterEntitlement is idempotent + only
      //      acts when the user has no currently-active plan.
      //   2. Redirect to /auth/complete-profile so the user can
      //      confirm / pick their role before seeing the dashboard.
      //      That page already no-ops for users who already have a
      //      role set, so it's safe as a universal landing.
      //
      // After this redirect the user's subscription_status has been
      // updated to "active" (free tier), so they won't bounce again
      // on the next dashboard load.
      try {
        await ensureStarterEntitlement(ctx.userId);
      } catch (err) {
        // Don't block the user if the assignment fails — the
        // redirect to complete-profile still makes sense and the
        // retry will happen naturally on next load.
        console.warn(
          "[dashboard layout] ensureStarterEntitlement failed:",
          err instanceof Error ? err.message : err,
        );
      }
      redirect("/auth/complete-profile?next=/dashboard");
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    // If profiles/status isn't available yet, don't block dashboard rendering.
  }

  return (
    <AgentWorkspaceProviders>
      <ToastProvider>
        <DashboardShell email={ctx?.email} appRole={appRole}>
          <OnboardingGate />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <AiChatPanel />
          <CommandPalette />
        </DashboardShell>
      </ToastProvider>
    </AgentWorkspaceProviders>
  );
}

