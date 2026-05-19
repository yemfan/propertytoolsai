import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { isRedirectError } from "@/lib/isRedirectError";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/**
 * Auth gate for the financial-services workspace.
 *
 * Demo phase: any signed-in user can enter (no role check) so the GFI pitch
 * demo works without provisioning a new role.
 *
 * Pre-pilot: restrict to a `financial_advisor` role on `leadsmart_users.role`.
 */
export default async function FinancialServicesDashboardLayout({ children }: { children: ReactNode }) {
  let email: string | null = null;

  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) redirect("/login?redirect=/financial-services/dashboard");
    email = userData.user.email ?? null;
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect("/login?redirect=/financial-services/dashboard");
  }

  return (
    <ToastProvider>
      <DashboardShell email={email} appRole="agent">
        <ErrorBoundary>{children}</ErrorBoundary>
      </DashboardShell>
    </ToastProvider>
  );
}
