import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import { UpgradeBanner } from "@/components/upsell/UpgradeBanner";
import OverviewClient from "./OverviewClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  description: "View your daily pipeline snapshot, lead activity, and key metrics.",
  keywords: ["dashboard", "overview", "real estate CRM"],
  robots: { index: false },
};

export default async function OverviewPage() {
  const ctx = await getCurrentAgentContext();

  const { data: profileRow } = await supabaseServer
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const greetingName =
    String((profileRow as { full_name?: string | null } | null)?.full_name ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";

  return (
    <div className="space-y-4">
      <UpgradeBanner planType={ctx.planType} variant="banner" />
      <OverviewClient greetingName={greetingName} planType={ctx.planType} />
    </div>
  );
}
