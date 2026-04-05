import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";
import { runKeywordDiscovery } from "@/lib/keywordDiscovery/pipeline";
import { pingSearchEngines } from "@/lib/seoOptimization/indexingPing";
import { getSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";

/**
 * Daily keyword discovery using env seed list (comma-separated).
 * GET /api/cron/keyword-discovery?secret=...
 *
 * Env: KEYWORD_DISCOVERY_SEEDS="seed1,seed2" (optional; default real estate mix)
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const defaultSeeds = [
    "cap rate rental property",
    "mortgage refinance",
    "first time home buyer",
    "investment property cash flow",
    "home equity line of credit",
  ];

  const raw = process.env.KEYWORD_DISCOVERY_SEEDS?.trim();
  const seeds = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : defaultSeeds;

  const url = new URL(req.url);
  const minPerSeed = Number(url.searchParams.get("minPerSeed") ?? process.env.KEYWORD_DISCOVERY_MIN_PER_SEED ?? 50);

  try {
    const result = await runKeywordDiscovery({
      seeds,
      minPerSeed: Number.isFinite(minPerSeed) ? minPerSeed : 50,
      persist: true,
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    // Ping search engines — sitemap has new content
    const siteUrl = getSiteUrl();
    pingSearchEngines({ siteUrl, newUrls: [] }).catch((e) =>
      console.warn("[keyword-discovery] indexing ping failed:", e?.message)
    );

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      stats: result.stats,
      seedsUsed: seeds.length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
