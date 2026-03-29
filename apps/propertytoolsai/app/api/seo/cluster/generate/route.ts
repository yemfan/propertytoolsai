import { NextResponse } from "next/server";
import {
  generateClusterPage,
  pickMissingClusterCombinations,
  runDailyClusterBatch,
  seedClusterTopicsFromConfig,
} from "@/lib/clusterGenerator/pipeline";
import { fetchExistingClusterPageKeys } from "@/lib/clusterGenerator/db";

export const runtime = "nodejs";

type Body = {
  topicSlug?: string;
  locationSlug?: string;
  force?: boolean;
  /** Run the same batch logic as the daily cron */
  dailyBatch?: boolean;
  /** Generate next N missing combinations (no topic/location needed) */
  batch?: boolean;
  limit?: number;
};

/**
 * POST /api/seo/cluster/generate
 * - Single: { topicSlug, locationSlug, force? }
 * - Daily-style batch: { dailyBatch: true }
 * - Custom batch: { batch: true, limit?: number }
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

  if (body.dailyBatch) {
    const out = await runDailyClusterBatch();
    return NextResponse.json({ ok: true, ...out });
  }

  if (body.batch) {
    const limit = Number(body.limit ?? process.env.CLUSTER_BATCH_LIMIT ?? 50);
    const existing = await fetchExistingClusterPageKeys();
    const pairs = pickMissingClusterCombinations(existing, Number.isFinite(limit) ? limit : 50);
    const results = [];
    for (const p of pairs) {
      results.push(await generateClusterPage(p.topicSlug, p.locationSlug, { force: true }));
    }
    const created = results.filter((r) => r.status === "created").length;
    return NextResponse.json({ ok: true, limit, processed: results.length, created, results });
  }

  const topicSlug = body.topicSlug?.trim();
  const locationSlug = body.locationSlug?.trim();
  if (!topicSlug || !locationSlug) {
    return NextResponse.json(
      { ok: false, error: "Provide topicSlug + locationSlug, or dailyBatch / batch" },
      { status: 400 }
    );
  }

  const seed = await seedClusterTopicsFromConfig();
  if (!seed.ok) {
    return NextResponse.json({ ok: false, error: seed.error ?? "seed failed" }, { status: 500 });
  }

  const result = await generateClusterPage(topicSlug, locationSlug, { force: Boolean(body.force) });
  return NextResponse.json({ ok: result.status !== "failed", result });
}
