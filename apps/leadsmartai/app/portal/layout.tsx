import { redirect } from "next/navigation";
import { ReactNode } from "react";
import AppDashboardShell from "@/components/dashboard/DashboardShell";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const dynamic = "force-dynamic";

/**
 * Portal layout — wraps /portal/* in the full dashboard shell (sidebar + topbar).
 * Requires authentication; redirects to /login if not signed in.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/portal");
  }

  let appRole: string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("leadsmart_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const roleRaw = (data as { role?: string } | null)?.role;
    appRole = typeof roleRaw === "string" && roleRaw.trim() ? roleRaw.trim() : null;
  } catch {
    // ignore — render without role-gated nav items
  }

  return (
    <AppDashboardShell email={user.email} appRole={appRole}>
      {children}
    </AppDashboardShell>
  );
}
