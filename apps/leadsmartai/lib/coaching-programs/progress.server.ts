import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  computeProgress,
  getDayOfYear,
  getDaysInYear,
  type ProgressInput,
} from "./progress";

/**
 * Server-side progress fetcher for LeadSmart AI Coaching widgets.
 *
 * Issues 3 head-only count queries in parallel:
 *   1. closed transactions YTD
 *   2. contacts created in the trailing 12 months (any source,
 *      excluding archived)
 *   3. distinct contacts in that window with at least one closed
 *      transaction — the conversion-rate numerator
 *
 * Bypasses RLS via the service-role client because the caller
 * has already resolved the agent context. Failure mode: returns
 * the zero-progress shape so the widget gracefully shows the
 * "no_data" tone instead of crashing.
 */
export async function loadProgressInput(
  agentId: string,
  nowMs: number = Date.now(),
): Promise<ProgressInput> {
  try {
    const now = new Date(nowMs);
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
    const twelveMonthsAgo = new Date(nowMs - 365 * 86_400_000).toISOString();

    const [
      { count: transactionsYtd },
      { count: contactsLast12Months },
      { data: closedContactsRows },
    ] = await Promise.all([
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("status", "closed")
        .gte("closing_date_actual", yearStart),
      supabaseAdmin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .neq("lifecycle_stage", "archived")
        .gte("created_at", twelveMonthsAgo),
      // For closed-contacts numerator: pull distinct contact_ids
      // from transactions (status=closed) joined to contacts in
      // the 12mo window. Postgres has no head-only DISTINCT count
      // through the JS client, so we read the ids and dedupe in
      // memory. Bounded by the agent's pipeline — 1000 cap is
      // safe for any solo agent.
      supabaseAdmin
        .from("transactions")
        .select("contact_id, contacts!inner(created_at, lifecycle_stage)")
        .eq("agent_id", agentId)
        .eq("status", "closed")
        .gte("contacts.created_at", twelveMonthsAgo)
        .neq("contacts.lifecycle_stage", "archived")
        .limit(1000),
    ]);

    const distinctClosed = new Set<string>();
    for (const row of (closedContactsRows ?? []) as Array<{
      contact_id: string | null;
    }>) {
      if (row.contact_id) distinctClosed.add(String(row.contact_id));
    }

    return {
      transactionsYtd: transactionsYtd ?? 0,
      contactsLast12Months: contactsLast12Months ?? 0,
      closedContactsLast12Months: distinctClosed.size,
      dayOfYear: getDayOfYear(now),
      daysInYear: getDaysInYear(now.getFullYear()),
    };
  } catch (e) {
    console.warn("[coaching.progress] load failed:", e);
    const now = new Date(nowMs);
    return {
      transactionsYtd: 0,
      contactsLast12Months: 0,
      closedContactsLast12Months: 0,
      dayOfYear: getDayOfYear(now),
      daysInYear: getDaysInYear(now.getFullYear()),
    };
  }
}

/**
 * Convenience: load + compute in one call. The API route uses
 * this when assembling the widget response.
 */
export async function loadProgressForAgent(args: {
  agentId: string;
  annualTransactionTarget: number;
  conversionRateTargetPct: number;
  nowMs?: number;
}) {
  const input = await loadProgressInput(args.agentId, args.nowMs);
  return computeProgress(input, {
    annualTransactionTarget: args.annualTransactionTarget,
    conversionRateTargetPct: args.conversionRateTargetPct,
  });
}
