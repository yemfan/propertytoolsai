import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { AgentWorkspaceProviders } from "@/components/entitlements/AgentWorkspaceProviders";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Account settings (profile, billing) use the same workspace chrome as `/dashboard`,
 * not the marketing Tools shell — see {@link AppShell} `isPlatformDashboardPath`.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/profile");
  }

  let appRole: string | null = null;
  try {
    const { data } = await supabaseServer
      .from("leadsmart_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const roleRaw = (data as { role?: string } | null)?.role;
    appRole = typeof roleRaw === "string" && roleRaw.trim() ? roleRaw.trim() : null;
  } catch {
    // ignore
  }

  return (
    <AgentWorkspaceProviders>
      <DashboardShell email={user.email} appRole={appRole}>
        {children}
      </DashboardShell>
    </AgentWorkspaceProviders>
  );
}
