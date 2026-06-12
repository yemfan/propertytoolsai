import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listListingsForAgent } from "@/lib/listings/service";
import { supabaseServer } from "@/lib/supabaseServer";
import ListingsTabs from "./ListingsTabs";

/**
 * Listings — agent-side inventory view, with Presentations as a tab
 * (a listing presentation is how a listing gets won; the old
 * /dashboard/seller-presentation page redirects here).
 *
 * URL kept as /dashboard/properties because the CommandPalette
 * already links there; sidebar entry is "Listings" under the Sales
 * Assistant.
 */
export const metadata: Metadata = {
  title: "Listings",
  description: "Your active listings — status, showings, offers, and seller presentations.",
  keywords: ["listings", "inventory", "active", "presentations"],
  robots: { index: false },
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ agentId }, { tab }] = await Promise.all([getCurrentAgentContext(), searchParams]);

  const [listings, { data: presentationProperties }] = await Promise.all([
    listListingsForAgent(String(agentId)),
    supabaseServer
      .from("properties_warehouse")
      .select("id, address, city, state, beds, baths, sqft, property_type, year_built")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <ListingsTabs
      initialTab={tab === "presentations" ? "presentations" : "listings"}
      listings={listings}
      presentationProperties={(presentationProperties ?? []) as Array<Record<string, unknown>>}
    />
  );
}
