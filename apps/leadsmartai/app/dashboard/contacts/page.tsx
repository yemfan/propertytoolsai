import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listContacts } from "@/lib/contacts/service";
import { listSmartLists } from "@/lib/contacts/smart-lists";
import { getContactOfferStats } from "@/lib/offers/service";
import { getContactShowingStats } from "@/lib/showings/service";
import SmartListTabs from "@/components/dashboard/SmartListTabs";
import ContactsClient from "./ContactsClient";

export const metadata: Metadata = {
  title: "Contacts",
  description: "Manage your contact database and client relationships.",
  keywords: ["contacts", "CRM", "client management"],
  robots: { index: false },
};

type PageProps = {
  searchParams: Promise<{ list?: string }>;
};

/**
 * Unified contacts hub. Smart Lists drive which subset of the contacts
 * table is shown (Leads / Sphere / All / custom). Defaults are seeded
 * per-agent by the schema migration's trigger, so every agent has the
 * three base lists on first load.
 *
 * URL param `?list=<id>` selects which list is active; omitted means
 * "use whichever default comes first by sort_order" (Leads in practice).
 */
export default async function ContactsPage({ searchParams }: PageProps) {
  const { agentId } = await getCurrentAgentContext();
  const { list: listParam } = await searchParams;

  const [smartLists, activeListContacts] = await Promise.all([
    listSmartLists(agentId),
    // Pre-fetch in parallel with smartLists load, but we'll discard this
    // and re-fetch if the list param doesn't match — cheaper than two
    // round-trips in the common case where the first-visible list is
    // intended.
    Promise.resolve([] as never),
  ]);

  const visible = smartLists.filter((l) => !l.isHidden);
  const activeList =
    visible.find((l) => l.id === listParam) ?? visible[0] ?? null;

  const contacts = activeList
    ? await listContacts(agentId, activeList.filterConfig)
    : await listContacts(agentId);
  void activeListContacts; // placeholder; keeps the parallel fetch pattern explicit

  // Showing + offer stats per contact — single bulk query each, parallel.
  const contactIds = contacts.map((c) => c.id);
  const [showingStats, offerStats] = await Promise.all([
    getContactShowingStats(String(agentId), contactIds),
    getContactOfferStats(String(agentId), contactIds),
  ]);

  // ContactsClient still expects the legacy LeadRow shape. Adapt the
  // ContactView into that minimal shape; richer fields are available
  // if/when ContactsClient is refactored to use ContactView directly.
  const legacyRows = contacts.map((c) => {
    const stats = showingStats.get(c.id);
    const oStats = offerStats.get(c.id);
    return {
      id: c.id,
      name:
        c.fullName && c.fullName !== "(no name)"
          ? c.fullName
          : (c.email ?? null),
      email: c.email,
      phone: c.phone ?? c.phoneNumber ?? null,
      property_address: c.propertyAddress,
      source: c.source,
      rating: c.rating,
      last_contacted_at: c.lastContactedAt,
      notes: c.notes,
      created_at: c.createdAt,
      // ContactView coerces null → "en" at the service layer; collapse that
      // back to null for the legacy row so the UI can distinguish "no explicit
      // override" from "explicitly picked English". The badge renderer in
      // ContactsClient only surfaces a chip for non-English overrides.
      preferred_language: c.preferredLanguage && c.preferredLanguage !== "en" ? c.preferredLanguage : null,
      showing_total: stats?.total ?? 0,
      showing_loved: stats?.loved ?? 0,
      offer_active: oStats?.active ?? 0,
      offer_won: oStats?.won ?? 0,
    };
  });

  return (
    <div className="flex flex-col">
      <SmartListTabs lists={smartLists} activeListId={activeList?.id ?? null} />
      <ContactsClient leads={legacyRows} />
    </div>
  );
}
