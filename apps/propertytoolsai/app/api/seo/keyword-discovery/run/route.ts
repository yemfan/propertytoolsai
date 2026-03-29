import { NextResponse } from "next/server";
import { runKeywordDiscovery } from "@/lib/keywordDiscovery/pipeline";

export const runtime = "nodejs";

type Body = {
  seeds?: string[];
  minPerSeed?: number;
  /** default true — set false to preview without DB */
  persist?: boolean;
};

/**
 * POST /api/seo/keyword-discovery/run
 * Body: { "seeds": ["cap rate", "mortgage calculator"], "minPerSeed": 50, "persist": true }
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const seeds = Array.isArray(body.seeds) ? body.seeds.map((s) => String(s).trim()).filter(Boolean) : [];
  if (seeds.length === 0) {
    return NextResponse.json({ ok: false, error: "`seeds` array required" }, { status: 400 });
  }

  if (body.persist !== false && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const result = await runKeywordDiscovery({
    seeds,
    minPerSeed: body.minPerSeed,
    persist: body.persist,
  });

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    runId: result.runId,
    stats: result.stats,
    candidates: result.candidates.slice(0, 200),
    totalReturned: result.candidates.length,
  });
}
