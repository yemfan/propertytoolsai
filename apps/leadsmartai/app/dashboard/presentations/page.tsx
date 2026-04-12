import { getCurrentAgentContext } from "@/lib/dashboardService";
import PresentationsClient from "@/app/dashboard/presentations/PresentationsClient";
import { supabaseServer } from "@/lib/supabaseServer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Presentations",
  description: "Create and manage listing and seller presentations.",
  keywords: ["presentations", "listing", "seller presentation"],
  robots: { index: false },
};

export default async function PresentationsPage() {
  const ctx = await getCurrentAgentContext();

  const { data } = await supabaseServer
    .from("presentations")
    .select("id,property_address,created_at")
    .eq("agent_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PresentationsClient initialPresentations={((data ?? []) as any) ?? []} />
  );
}

