import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildForecastSummary,
  type ForecastInputRow,
  type ForecastSummary,
} from "@/lib/performance/commissionForecast";

/**
 * Server-side orchestrator for the commission-forecast surface.
 *
 * Pulls active + pending transactions for the agent, projects them onto
 * the slim ForecastInputRow shape, and runs the pure aggregator. Volume
 * per agent is small (tens of in-flight deals max) so we fetch + reduce
 * in memory rather than relying on a SQL group-by.
 *
 * Closed deals are intentionally excluded — they belong to RevenuePanel
 * (lib/performance/revenueService.ts), which already covers earned
 * commission with monthly buckets + days-to-close + offer funnel + CSV.
 * This module is the forward-looking complement.
 */

export async function getCommissionForecast(
  agentId: string,
  opts: { nowIso?: string } = {},
): Promise<ForecastSummary> {
  const nowIso = opts.nowIso ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, transaction_type, status, property_address, closing_date, gross_commission, agent_net_commission, mutual_acceptance_date",
    )
    .eq("agent_id", agentId)
    .in("status", ["active", "pending"]);

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Array<{
    id: string;
    transaction_type: ForecastInputRow["transactionType"];
    status: ForecastInputRow["status"];
    property_address: string;
    closing_date: string | null;
    gross_commission: number | null;
    agent_net_commission: number | null;
    mutual_acceptance_date: string | null;
  }>).map<ForecastInputRow>((r) => ({
    id: r.id,
    transactionType: r.transaction_type,
    status: r.status,
    propertyAddress: r.property_address,
    closingDate: r.closing_date,
    grossCommission: r.gross_commission,
    agentNetCommission: r.agent_net_commission,
    mutualAcceptanceDate: r.mutual_acceptance_date,
  }));

  return buildForecastSummary(rows, nowIso);
}
