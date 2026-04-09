import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";
import { isRedirectError } from "@/lib/isRedirectError";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default async function LoanBrokerLayout({ children }: { children: ReactNode }) {
  let email: string | null = null;
  let appRole: string | null = null;

  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) redirect("/login?redirect=/loan-broker/dashboard");

    email = userData.user.email ?? null;

    const { data: lsUser } = await supabaseServer
      .from("leadsmart_users")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    appRole = (lsUser as any)?.role ?? null;

    if (appRole !== "broker" && appRole !== "admin" && appRole !== "support") {
      redirect("/dashboard");
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect("/login?redirect=/loan-broker/dashboard");
  }

  return (
    <ToastProvider>
      <DashboardShell email={email} appRole={appRole} navConfigOverride="broker">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </DashboardShell>
    </ToastProvider>
  );
}
