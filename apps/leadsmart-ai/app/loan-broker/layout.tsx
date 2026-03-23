import { ReactNode } from "react";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { ensurePortalAccess, fetchUserPortalContext } from "@/lib/rolePortalServer";

/** Loan broker workspace — same access model as brokerage leadership (`/broker`). */
export default async function LoanBrokerLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  ensurePortalAccess("broker", ctx);
  return <>{children}</>;
}
