import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Admin tool-funnel analytics. Reads `public.events` for the last N
 * days and aggregates per-tool funnel: page uses (`*_used` events) →
 * lead captures (`tool_lead_capture` events, filtered by metadata.tool)
 * → saves (`saved_tool_results` inserts).
 *
 * The 3-step funnel answers: "for every visitor who ran the mortgage
 * calculator this week, how many gave us an email, and how many saved
 * a scenario?" Cheap to compute — each step is one indexed count.
 */

export type ToolFunnelRow = {
  tool: string;
  usedCount: number;
  leadCount: number;
  saveCount: number;
  leadConversionPct: number | null;
  saveConversionPct: number | null;
};

// Map from `*_used` event names back to the canonical tool key we
// display everywhere else. Extend when new calculators are added.
const USED_EVENT_TO_TOOL: Record<string, string> = {
  mortgage_used: "mortgage_calculator",
  affordability_used: "affordability_calculator",
  cap_rate_used: "cap_rate_calculator",
  cap_rate_roi_used: "cap_rate_roi_calculator",
  cash_flow_used: "cash_flow_calculator",
  down_payment_used: "down_payment_calculator",
  adjustable_rate_used: "adjustable_rate_calculator",
  refinance_used: "refinance_calculator",
  rent_vs_buy_used: "rent_vs_buy",
  cma_used: "ai_cma_analyzer",
  home_value_used: "home_value_estimator",
};

const TOOL_DISPLAY_LABEL: Record<string, string> = {
  mortgage_calculator: "Mortgage",
  affordability_calculator: "Affordability",
  cap_rate_calculator: "Cap rate",
  cap_rate_roi_calculator: "Cap rate + ROI (retired)",
  cash_flow_calculator: "Cash flow",
  down_payment_calculator: "Down payment",
  adjustable_rate_calculator: "ARM",
  refinance_calculator: "Refinance",
  rent_vs_buy: "Rent vs buy",
  ai_cma_analyzer: "AI CMA",
  ai_deal_analyzer: "AI deal analyzer",
  rental_property_analyzer: "Rental property",
  home_value_estimator: "Home value estimate",
  property_investment_analyzer: "Investment analyzer (retired)",
  roi_calculator: "ROI",
  closing_cost_estimator: "Closing costs",
};

export function toolLabel(key: string): string {
  return TOOL_DISPLAY_LABEL[key] ?? key;
}

export async function getToolFunnel(opts?: {
  sinceDays?: number;
}): Promise<{ sinceIso: string; rows: ToolFunnelRow[] }> {
  const sinceDays = opts?.sinceDays ?? 7;
  const sinceMs = Date.now() - sinceDays * 24 * 3600 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Step 1: pull all `*_used` events in window. Each row = one tool
  // invocation. We aggregate in-process — the event table is small
  // enough for a 7-day window that this is faster than sending 14
  // separate count queries.
  const { data: usedRows, error: usedErr } = await supabaseAdmin
    .from("events")
    .select("event_type")
    .gte("created_at", sinceIso)
    .like("event_type", "%_used")
    .limit(100_000);
  if (usedErr) throw new Error(usedErr.message);

  const usedByTool = new Map<string, number>();
  for (const r of (usedRows ?? []) as Array<{ event_type: string }>) {
    const tool = USED_EVENT_TO_TOOL[r.event_type];
    if (!tool) continue;
    usedByTool.set(tool, (usedByTool.get(tool) ?? 0) + 1);
  }

  // Step 2: lead captures in window. Metadata.tool carries the tool key.
  const { data: leadRows, error: leadErr } = await supabaseAdmin
    .from("events")
    .select("metadata")
    .eq("event_type", "tool_lead_capture")
    .gte("created_at", sinceIso)
    .limit(100_000);
  if (leadErr) throw new Error(leadErr.message);

  const leadsByTool = new Map<string, number>();
  for (const r of (leadRows ?? []) as Array<{
    metadata: Record<string, unknown> | null;
  }>) {
    const tool =
      typeof r.metadata?.tool === "string"
        ? (r.metadata.tool as string)
        : null;
    if (!tool) continue;
    leadsByTool.set(tool, (leadsByTool.get(tool) ?? 0) + 1);
  }

  // Step 3: saved scenarios in window.
  const { data: saveRows, error: saveErr } = await supabaseAdmin
    .from("saved_tool_results")
    .select("tool")
    .gte("created_at", sinceIso)
    .limit(100_000);
  if (saveErr) {
    // Table may not exist yet in staging — treat as zero saves.
    console.warn("[adminFunnel] saved_tool_results query failed:", saveErr.message);
  }

  const savesByTool = new Map<string, number>();
  for (const r of (saveRows ?? []) as Array<{ tool: string }>) {
    savesByTool.set(r.tool, (savesByTool.get(r.tool) ?? 0) + 1);
  }

  // Union of all tool keys that appeared anywhere this week.
  const tools = new Set<string>([
    ...usedByTool.keys(),
    ...leadsByTool.keys(),
    ...savesByTool.keys(),
  ]);

  const rows: ToolFunnelRow[] = [];
  for (const tool of tools) {
    const used = usedByTool.get(tool) ?? 0;
    const leads = leadsByTool.get(tool) ?? 0;
    const saves = savesByTool.get(tool) ?? 0;
    rows.push({
      tool,
      usedCount: used,
      leadCount: leads,
      saveCount: saves,
      leadConversionPct: used > 0 ? (leads / used) * 100 : null,
      saveConversionPct: used > 0 ? (saves / used) * 100 : null,
    });
  }

  // Sort by most-used first — that's where the attention belongs.
  rows.sort((a, b) => b.usedCount - a.usedCount);

  return { sinceIso, rows };
}
