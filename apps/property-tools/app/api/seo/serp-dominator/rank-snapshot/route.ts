import { NextResponse } from "next/server";
import { insertRankSnapshot, listRankSnapshotsForKeyword } from "@/lib/serpDominator/db";
import { normalizeKeywordForDedupe } from "@/lib/keywordDiscovery/normalize";

export const runtime = "nodejs";

type PostBody = {
  keyword?: string;
  pagePath?: string;
  position?: number | null;
  urlInSerp?: string | null;
  source?: string;
  notes?: string | null;
  recordedAt?: string;
};

/**
 * POST /api/seo/serp-dominator/rank-snapshot — record a ranking observation (manual / GSC import).
 * GET ?keyword=... — list recent snapshots for normalized keyword.
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const keyword = body.keyword?.trim();
  const pagePath = body.pagePath?.trim();
  if (!keyword || !pagePath) {
    return NextResponse.json({ ok: false, error: "`keyword` and `pagePath` required" }, { status: 400 });
  }

  const keywordNormalized = normalizeKeywordForDedupe(keyword);
  const r = await insertRankSnapshot({
    keywordNormalized,
    pagePath,
    position: body.position ?? null,
    urlInSerp: body.urlInSerp,
    source: body.source,
    notes: body.notes,
    recordedAt: body.recordedAt,
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const keyword = url.searchParams.get("keyword")?.trim();
  if (!keyword) {
    return NextResponse.json({ ok: false, error: "query `keyword` required" }, { status: 400 });
  }

  const keywordNormalized = normalizeKeywordForDedupe(keyword);
  const rows = await listRankSnapshotsForKeyword(keywordNormalized);
  return NextResponse.json({ ok: true, keywordNormalized, rows });
}
