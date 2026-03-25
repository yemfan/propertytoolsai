import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * GET /api/home-value/session?session_id=...
 * Hydrate funnel row for a returning tab (best-effort).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = String(
      searchParams.get("session_id") ?? searchParams.get("sessionId") ?? ""
    ).trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("home_value_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.warn("GET /api/home-value/session", error.message);
      return NextResponse.json({ ok: false, error: "Failed to load session." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session: data ?? null });
  } catch (e: any) {
    console.error("GET /api/home-value/session", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
