import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listListingsForAgent } from "@/lib/listings/service";
import ListingsClient from "./ListingsClient";

/**
 * Listings — agent-side inventory view.
 *
 * Surfaces the agent's listing-rep + dual transactions with showings
 * activity rolled up per property. URL kept as /dashboard/properties
 * because the CommandPalette already links there; sidebar entry is
 * labelled "Listings" (under Sellers).
 */
export const metadata: Metadata = {
  title: "Listings",
  description: "Your active listings — status, showings, and offers.",
  keywords: ["listings", "inventory", "active"],
  robots: { index: false },
};

export default async function ListingsPage() {
  const { agentId } = await getCurrentAgentContext();
  const listings = await listListingsForAgent(String(agentId));
  return <ListingsClient listings={listings} />;
}
