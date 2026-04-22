import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getListingOfferWithCounters } from "@/lib/listing-offers/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ListingOfferDetailClient } from "./ListingOfferDetailClient";

export const metadata: Metadata = {
  title: "Listing offer",
  robots: { index: false },
};

type PageProps = { params: Promise<{ id: string }> };

export default async function ListingOfferDetailPage({ params }: PageProps) {
  const { agentId } = await getCurrentAgentContext();
  const { id } = await params;
  const result = await getListingOfferWithCounters(String(agentId), id);
  if (!result) notFound();

  // Grab the parent transaction address for breadcrumb / back link.
  const { data: txRow } = await supabaseAdmin
    .from("transactions")
    .select("id, property_address")
    .eq("id", result.offer.transaction_id)
    .eq("agent_id", String(agentId))
    .maybeSingle();

  return (
    <ListingOfferDetailClient
      offer={result.offer}
      counters={result.counters}
      transaction={
        txRow
          ? (txRow as { id: string; property_address: string })
          : { id: result.offer.transaction_id, property_address: "Listing" }
      }
    />
  );
}
