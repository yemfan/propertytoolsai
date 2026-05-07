import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/agent/lead-activity?limit=20&hotLeadIds=a,b,c
 *
 * Returns two things in one round-trip:
 *
 *   1. `events` — recent PropertyToolsAI tool_events for the agent's
 *      claimed contacts (`contacts.agent_id = current agent`). Joined
 *      via case-insensitive email match against auth.users → tool_events.
 *      Only contacts the agent has claimed via the lead-queue flow are
 *      visible; unclaimed leads aren't yet "owned" by anyone.
 *
 *   2. `intentCounts` — per-lead tool-use count over the last 24h for
 *      the supplied `hotLeadIds`. Powers the "🔥 N tool uses in 24h"
 *      badge on the Hot Leads card. Optional — omit `hotLeadIds` to
 *      skip this query.
 *
 * Both queries run via SECURITY DEFINER RPCs in the leadsmartai
 * supabase migrations (see 20260619000000_agent_lead_activity_rpcs.sql)
 * because the join touches the `auth` schema which isn't exposed via
 * PostgREST.
 */
export async function GET(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (profile.role !== "agent" && profile.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100)
      : 20;

    const hotLeadIdsRaw = searchParams.get("hotLeadIds")?.trim() ?? "";
    const hotLeadIds = hotLeadIdsRaw
      ? hotLeadIdsRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
      : [];

    // The RPC takes a numeric agent id (matches contacts.agent_id which
    // FKs to public.agents.id, a bigint). Both `profile.agent_id` and
    // `profile.id` could be the right value depending on how the
    // profile was hydrated; prefer agent_id.
    const agentIdStr = String(profile.agent_id ?? profile.id ?? "");
    const agentId = Number(agentIdStr);
    if (!Number.isFinite(agentId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid agent id" },
        { status: 400 },
      );
    }

    // Fire both RPCs in parallel — only run the intent-count one if
    // the caller asked for it via hotLeadIds.
    const [activityRes, intentRes] = await Promise.all([
      supabaseAdmin.rpc("get_agent_lead_activity", {
        p_agent_id: agentId,
        p_limit: limit,
      }),
      hotLeadIds.length > 0
        ? supabaseAdmin.rpc("get_lead_recent_tool_use_counts", {
            p_agent_id: agentId,
            p_lead_ids: hotLeadIds,
            p_window_hours: 24,
          })
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ]);

    if (activityRes.error) {
      console.error("[lead-activity] activity rpc:", activityRes.error.message);
      return NextResponse.json(
        { ok: false, error: activityRes.error.message },
        { status: 500 },
      );
    }
    if (intentRes.error) {
      // Non-fatal — we just won't render the badges. Activity feed
      // still ships.
      console.warn("[lead-activity] intent rpc:", intentRes.error.message);
    }

    type ActivityRow = {
      lead_id: string;
      lead_name: string | null;
      lead_email: string | null;
      tool_name: string;
      event_name: string;
      metadata: Record<string, unknown> | null;
      occurred_at: string;
    };
    type IntentRow = {
      lead_id: string;
      use_count: number;
      last_event_at: string | null;
    };

    const events = ((activityRes.data ?? []) as ActivityRow[]).map((r) => ({
      leadId: r.lead_id,
      leadName: r.lead_name ?? r.lead_email ?? "Unknown lead",
      leadEmail: r.lead_email,
      toolName: r.tool_name,
      toolLabel: humanizeToolName(r.tool_name),
      eventName: r.event_name,
      propertyAddress: extractAddress(r.metadata),
      occurredAt: r.occurred_at,
    }));

    const intentCounts: Record<string, { count: number; lastAt: string | null }> = {};
    for (const r of (intentRes.data ?? []) as IntentRow[]) {
      intentCounts[r.lead_id] = {
        count: Number(r.use_count) || 0,
        lastAt: r.last_event_at,
      };
    }

    return NextResponse.json({ ok: true, events, intentCounts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/dashboard/agent/lead-activity:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Map raw tool_events.tool_name (snake_case event identifiers like
 * `mortgage_calculator`, `cash_flow`) into a human-readable label
 * for the activity feed UI.
 */
function humanizeToolName(toolName: string): string {
  switch (toolName) {
    case "mortgage_calculator":
    case "mortgage":
      return "Mortgage Calculator";
    case "affordability":
    case "affordability_calculator":
      return "Affordability Calculator";
    case "rent_vs_buy":
      return "Rent vs Buy";
    case "cap_rate":
    case "cap_rate_calculator":
      return "Cap Rate Calculator";
    case "cash_flow":
    case "cash_flow_calculator":
      return "Cash Flow Calculator";
    case "refinance":
    case "refinance_calculator":
      return "Refinance Calculator";
    case "home_value":
      return "Home Value Estimator";
    case "cma":
      return "CMA Report";
    case "ai_property_comparison":
    case "property_comparison":
      return "AI Property Comparison";
    case "ai_recommended_properties":
      return "AI Recommended Properties";
    case "smart_next_steps":
      return "Smart Next Steps";
    default:
      // Title-case the snake_case name as a fallback.
      return toolName
        .split("_")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

/**
 * Pull a property address out of the loosely-typed metadata blob.
 * tracking.ts callers store the address under various keys depending
 * on the tool — try the common ones.
 */
function extractAddress(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  for (const k of [
    "propertyAddress",
    "property_address",
    "address",
    "homeAddress",
    "subject_address",
  ]) {
    const v = metadata[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
