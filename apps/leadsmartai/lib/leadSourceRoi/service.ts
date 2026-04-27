import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import { aggregateBySource } from "@/lib/leadSourceRoi/aggregate";
import type {
  LeadSourceRoiInputContact,
  LeadSourceRoiReport,
} from "@/lib/leadSourceRoi/types";

/**
 * Service: fetch contacts for an agent within a date range and delegate
 * grouping/aggregation to the pure module. Pure helpers are testable
 * without DB mocking; this layer is the supabase boundary only.
 *
 * Cohort definition: contacts whose `created_at` falls in the window. We
 * include contacts whose lifecycle is `past_client` (closed deals)
 * regardless of when they closed — what matters for ROI is when the LEAD
 * was captured. An IDX lead captured in Q1 that closed in Q4 still
 * "belongs to" Q1 ROI.
 *
 * Hard cap of 5,000 rows per call. Pilot agents will be far below this;
 * larger agents will need pagination + memoization, but that's a later
 * problem (the dashboard panel queries this once per visit and the data
 * doesn't change rapidly).
 */

const MAX_ROWS = 5000;

/**
 * Default window: trailing 90 days. Aligns with how every other CRM in
 * this category defaults its lead reports — "Q to date" is the next-most-
 * common, but trailing-90 is more honest for new agents who don't yet have
 * a full quarter of data.
 */
export const DEFAULT_WINDOW_DAYS = 90;

export type FetchLeadSourceRoiOptions = {
  /** ISO start (inclusive). Defaults to now - DEFAULT_WINDOW_DAYS. */
  startDate?: string;
  /** ISO end (exclusive). Defaults to now (rounded to top-of-second). */
  endDate?: string;
};

function defaultRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const end = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const start = new Date(end.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

type ContactRow = {
  source: string | null;
  lead_status: string | null;
  lifecycle_stage: string | null;
  closing_price: number | null;
  created_at: string;
  closing_date: string | null;
};

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    /does not exist|schema cache/i.test(e.message ?? "")
  );
}

function mapRowToInput(row: ContactRow): LeadSourceRoiInputContact {
  return {
    source: row.source,
    leadStatus: row.lead_status,
    lifecycleStage: row.lifecycle_stage,
    closingPrice:
      typeof row.closing_price === "number" && Number.isFinite(row.closing_price)
        ? row.closing_price
        : null,
    createdAt: row.created_at,
    closingDate: row.closing_date,
  };
}

export async function fetchLeadSourceRoiForAgent(
  agentId: string,
  opts: FetchLeadSourceRoiOptions = {},
): Promise<LeadSourceRoiReport> {
  const { startDate: defStart, endDate: defEnd } = defaultRange();
  const startDate = opts.startDate ?? defStart;
  const endDate = opts.endDate ?? defEnd;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(
      "source,lead_status,lifecycle_stage,closing_price,created_at,closing_date",
    )
    .eq("agent_id", agentId as never)
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .limit(MAX_ROWS);

  if (error) {
    if (isMissingRelationError(error)) {
      // Schema isn't applied (fresh dev DB, etc.) — degrade to an empty
      // report rather than failing the dashboard request.
      return aggregateBySource([], startDate, endDate);
    }
    throw error;
  }

  const inputs = ((data ?? []) as ContactRow[]).map(mapRowToInput);
  return aggregateBySource(inputs, startDate, endDate);
}
