import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { isRedirectError } from "@/lib/isRedirectError";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import FinancialServicesTopNav from "./FinancialServicesTopNav";

/**
 * Auth gate + minimal top-nav-only shell for the financial-services workspace.
 *
 * Sidebar is intentionally absent — the standard CRM sidebar is real-estate-flavored
 * and distracts from this vertical's demo. Top tabs cover the four dashboard surfaces.
 *
 * Demo phase: any signed-in user can enter (no role check).
 * Pre-pilot: restrict to a `financial_advisor` role on `leadsmart_users.role`.
 */
export default async function FinancialServicesDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
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
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <FinancialServicesTopNav email={email} />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  );
}
