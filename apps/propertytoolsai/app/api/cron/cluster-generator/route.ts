import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";
import { runDailyClusterBatch } from "@/lib/clusterGenerator/pipeline";
import { pingSearchEngines } from "@/lib/seoOptimization/indexingPing";
import { getSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";

/**
 * Daily cron: generate CLUSTER_DAILY_LIMIT new cluster pages (missing topic×location pairs).
 * After generation, pings Google/Bing + submits new URLs via IndexNow.
 * GET /api/cron/cluster-generator?secret=...
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const out = await runDailyClusterBatch();

    // Notify search engines of new pages (fire-and-forget, don't fail the cron)
    const siteUrl = getSiteUrl();
    const newUrls: string[] = (out as any).newPaths?.map(
      (p: string) => `${siteUrl.replace(/\/$/, "")}${p}`
    ) ?? [];
    pingSearchEngines({ siteUrl, newUrls }).catch((e) =>
      console.warn("[cluster-generator] indexing ping failed:", e?.message)
    );

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
