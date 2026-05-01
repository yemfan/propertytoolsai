import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import { PlaybooksPageClient } from "./PlaybooksPageClient";

export const dynamic = "force-dynamic";

/**
 * Standalone playbooks page — agent's cross-anchor "my checklists"
 * landing view. Shows every playbook task regardless of anchor
 * (transaction, open-house, contact).
 *
 * Generic-anchored playbooks (the only ones that don't need a linked
 * entity) are still applied here. Lead-bound playbooks (write_offer,
 * seller_presentation, listing_launch) are also applied here, but the
 * agent picks a contact in the modal — SSR fetches the list so the
 * picker is populated without a flash.
 */
export default async function PlaybooksPage() {
  const ctx = await getCurrentAgentContext();

  const { data: leads } = await supabaseServer
    .from("contacts")
    .select("id, name")
    .eq("agent_id", ctx.agentId)
    .limit(500);

  return (
    <PlaybooksPageClient
      leads={(leads ?? []).map((l: { id: string | number; name: string | null }) => ({
        id: String(l.id),
        name: l.name,
      }))}
    />
  );
}
