import { ReactNode } from "react";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { ensurePortalAccess, fetchUserPortalContext } from "@/lib/rolePortalServer";

export default async function AdminPortalLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  ensurePortalAccess("admin", ctx);
  return <>{children}</>;
}
