import OverviewPage from "./overview/page";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { BROKER_PORTAL_ROLES } from "@/lib/rolePortalPaths";

/**
 * `/dashboard` — agents see the standard overview; brokerage roles land on the broker dashboard.
 */
export default async function DashboardRootPage() {
  const supabase = supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("leadsmart_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const r = String((profile as { role?: string } | null)?.role ?? "")
      .toLowerCase()
      .trim();
    if (BROKER_PORTAL_ROLES.has(r)) {
      redirect("/dashboard/broker");
    }
  }

  return <OverviewPage />;
}
