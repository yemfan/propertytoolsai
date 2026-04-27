/**
 * Lead-source ROI report types.
 *
 * Cohort definition: contacts whose `created_at` falls inside the date range,
 * grouped by `source`. We slice on lead-generation time (not closing time)
 * because the agent's question is "of the leads I captured this quarter,
 * which channels actually produced revenue" — that's the cohort view.
 *
 * "Won" means `lifecycle_stage = 'past_client'` (the schema's terminal-success
 * state — `lead_status` alone isn't enough because some flows skip it).
 */

/** Minimal contact row the aggregator needs. Service layer projects to this shape. */
export type LeadSourceRoiInputContact = {
  source: string | null;
  leadStatus: string | null;
  lifecycleStage: string | null;
  closingPrice: number | null;
  createdAt: string;
  closingDate: string | null;
};

/** One row of the report — one source. */
export type LeadSourceRoiRow = {
  /** Raw value from `contacts.source`. Null/blank gets bucketed into one row. */
  sourceKey: string;
  /** Humanized label for the table. */
  sourceLabel: string;
  /** Total contacts captured in the window with this source. */
  leads: number;
  /** Subset of `leads`: `lead_status` advanced to qualified/won. */
  qualified: number;
  /** Subset of `leads`: `lifecycle_stage = 'past_client'` (closed deal). */
  won: number;
  /** Conversion = won / leads, rounded to 2 decimals (0–100). 0 when leads = 0. */
  conversionPct: number;
  /** Sum of `closing_price` across won deals in this source. 0 when no closes. */
  totalVolume: number;
  /** Mean of `closing_price` across won deals in this source. 0 when no closes. */
  avgDealValue: number;
  /** Mean days from `created_at` → `closing_date` across won deals. Null when no closes. */
  avgDaysToClose: number | null;
};

export type LeadSourceRoiReport = {
  /** ISO start of the window (inclusive). */
  startDate: string;
  /** ISO end of the window (exclusive). */
  endDate: string;
  rows: LeadSourceRoiRow[];
  /** Roll-up totals across all rows — the "All sources" KPI line on the panel. */
  totals: {
    leads: number;
    qualified: number;
    won: number;
    conversionPct: number;
    totalVolume: number;
    avgDealValue: number;
  };
};
