import { ReactNode } from "react";
import AppDashboardShell from "@/components/dashboard/DashboardShell";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { ensurePortalAccess, fetchUserPortalContext } from "@/lib/rolePortalServer";

export default async function AdminPortalLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  ensurePortalAccess("admin", ctx);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  const appRole = ctx?.role ?? null;

  return (
    <AppDashboardShell email={email} appRole={appRole}>
      {children}
    </AppDashboardShell>
  );
}
