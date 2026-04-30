import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/briefings
 *
 * Returns recent morning + evening briefings for the current agent.
 * Default: 7 of each kind, newest first. The dashboard card shows
 * the latest of each side-by-side and lets the agent page through
 * history.
 *
 * Query:
 *   - limit (1..30, default 7) — per kind
 */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getCurrentAgentContext();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("limit") ?? 7);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(1, requested), 30) : 7;

  const fetchKind = async (kind: "morning" | "evening") => {
    const { data, error } = await supabaseAdmin
      .from("daily_briefings")
      .select("id,kind,headline,summary,insights,created_at")
      .eq("agent_id", ctx.agentId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[briefings] list", { kind, error });
      return [];
    }
    return data ?? [];
  };

  const [morning, evening] = await Promise.all([
    fetchKind("morning"),
    fetchKind("evening"),
  ]);

  return NextResponse.json({ ok: true, morning, evening });
}
