import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/mobile/briefings
 *
 * Mobile mirror of /api/dashboard/briefings. Returns the recent
 * morning + evening briefings for the authenticated agent so the
 * Expo home screen can render the same two cards the web dashboard
 * shows.
 *
 * Query:
 *   - limit (1..30, default 7) — per kind. Mobile typically only
 *     uses the latest of each, but we keep the same shape as the
 *     web endpoint for parity.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("limit") ?? 7);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(1, requested), 30)
    : 7;

  const fetchKind = async (kind: "morning" | "evening") => {
    const { data, error } = await supabaseAdmin
      .from("daily_briefings")
      .select("id,kind,headline,summary,insights,created_at")
      .eq("agent_id", auth.ctx.agentId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[mobile/briefings] list", { kind, error });
      return [];
    }
    return data ?? [];
  };

  const [morning, evening] = await Promise.all([
    fetchKind("morning"),
    fetchKind("evening"),
  ]);

  return NextResponse.json({
    ok: true,
    success: true,
    morning,
    evening,
  });
}
