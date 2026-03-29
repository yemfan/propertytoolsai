import { NextResponse } from "next/server";
import { runSerpDominatorCampaign } from "@/lib/serpDominator/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  keyword?: string;
  clusterHint?: string;
  siteOrigin?: string;
};

/**
 * POST /api/seo/serp-dominator/generate
 * Creates 5 page types (tool, landing, blog, comparison, faq) for one seed keyword.
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const keyword = body.keyword?.trim();
  if (!keyword) {
    return NextResponse.json({ ok: false, error: "`keyword` is required" }, { status: 400 });
  }

  const result = await runSerpDominatorCampaign(keyword, {
    clusterHint: body.clusterHint,
    siteOrigin: body.siteOrigin,
  });

  return NextResponse.json({
    ok: !result.error,
    campaignId: result.campaignId,
    keywordSlug: result.keywordSlug,
    pages: result.pages,
    error: result.error,
  });
}
