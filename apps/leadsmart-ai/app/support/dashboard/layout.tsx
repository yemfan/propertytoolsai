import { ReactNode } from "react";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { ensurePortalAccess, fetchUserPortalContext } from "@/lib/rolePortalServer";

/** Support / platform ops — same portal gate as `/admin`. */
export default async function SupportDashboardLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  ensurePortalAccess("admin", ctx);
  return <>{children}</>;
}
