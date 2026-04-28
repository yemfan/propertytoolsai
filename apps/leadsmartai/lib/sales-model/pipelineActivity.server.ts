import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  EMPTY_ACTIVITY_SNAPSHOT,
  type ActivitySnapshot,
} from "./pipelineActivity";

/**
 * Server-side fetcher for the sales-model pipeline activity snapshot.
 *
 * Issues 10 head-only count queries in parallel against `contacts` and
 * `transactions`. Bypasses RLS via the service-role client because the
 * caller has already resolved the agent context — same pattern used by
 * lib/coaching/service.ts.
 *
 * Failure mode: any DB error returns the empty snapshot rather than
 * surfacing. The pipeline panel is decorative — a partial outage on
 * counts shouldn't blow up the dashboard.
 */
export async function loadActivitySnapshot(
  agentId: string,
  nowMs: number = Date.now(),
): Promise<ActivitySnapshot> {
  try {
    const sevenDaysAgo = new Date(nowMs - 7 * 86_400_000).toISOString();
    const sevenDaysAhead = new Date(nowMs + 7 * 86_400_000).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    const contacts = () =>
      supabaseAdmin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId);
    const transactions = () =>
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId);

    const [
      { count: totalContacts },
      { count: newContactsLast7d },
      { count: leadCount },
      { count: activeClientCount },
      { count: pastClientCount },
      { count: hotContactCount },
      { count: contactedLast7d },
      { count: upcomingTouchpoints },
      { count: activeTransactionCount },
      { count: closedTransactionCount },
    ] = await Promise.all([
      contacts().neq("lifecycle_stage", "archived"),
      contacts().gte("created_at", sevenDaysAgo),
      contacts().eq("lifecycle_stage", "lead"),
      contacts().eq("lifecycle_stage", "active_client"),
      contacts().eq("lifecycle_stage", "past_client"),
      contacts().in("rating", ["A", "B"]),
      contacts().gte("last_contacted_at", sevenDaysAgo),
      contacts()
        .gte("next_contact_at", nowIso)
        .lte("next_contact_at", sevenDaysAhead),
      transactions().eq("status", "active"),
      transactions().eq("status", "closed"),
    ]);

    return {
      totalContacts: totalContacts ?? 0,
      newContactsLast7d: newContactsLast7d ?? 0,
      leadCount: leadCount ?? 0,
      activeClientCount: activeClientCount ?? 0,
      pastClientCount: pastClientCount ?? 0,
      hotContactCount: hotContactCount ?? 0,
      contactedLast7d: contactedLast7d ?? 0,
      upcomingTouchpoints: upcomingTouchpoints ?? 0,
      activeTransactionCount: activeTransactionCount ?? 0,
      closedTransactionCount: closedTransactionCount ?? 0,
    };
  } catch (e) {
    console.warn("[sales-model] loadActivitySnapshot failed:", e);
    return EMPTY_ACTIVITY_SNAPSHOT;
  }
}
