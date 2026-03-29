import { NextResponse } from "next/server";
import { runCompetitorAnalysis } from "@/lib/competitorIntel/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  domain?: string;
  maxPages?: number;
  maxSitemapUrls?: number;
  crawlDelayMs?: number;
};

/**
 * POST /api/seo/competitor/analyze
 * Body: { "domain": "example.com", "maxPages": 15 }
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const domain = body.domain?.trim();
  if (!domain) {
    return NextResponse.json({ ok: false, error: "`domain` is required" }, { status: 400 });
  }

  const result = await runCompetitorAnalysis(domain, {
    maxPages: body.maxPages,
    maxSitemapUrls: body.maxSitemapUrls,
    crawlDelayMs: body.crawlDelayMs,
  });

  if (result.error && !result.runId) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: !result.error,
    runId: result.runId,
    domain: result.domain,
    pagesCrawled: result.pagesCrawled,
    keywordsExtracted: result.keywordsExtracted,
    opportunities: result.opportunities.slice(0, 100),
    opportunitiesTotal: result.opportunities.length,
    error: result.error,
  });
}
