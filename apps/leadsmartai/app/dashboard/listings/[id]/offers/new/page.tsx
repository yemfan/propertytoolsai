import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getListingById } from "@/lib/listings/service";
import { NewListingOfferClient } from "./NewListingOfferClient";

export const metadata: Metadata = {
  title: "Record offer",
  robots: { index: false },
};

/**
 * New listing-side offer form. Replaces the cramped inline form
 * the listing detail page used to render — full set of fields for
 * an offer that the seller can actually use to make a selection
 * decision (price, terms, contingencies, financing, commission,
 * timing). Plus a PDF-upload affordance at the top that calls
 * /api/dashboard/offers/parse-pdf and pre-fills every field
 * Claude can extract.
 */
export default async function NewListingOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { agentId } = await getCurrentAgentContext();
  const { id } = await params;
  const listing = await getListingById(String(agentId), id);
  if (!listing) {
    notFound();
  }
  return <NewListingOfferClient listing={listing} />;
}
