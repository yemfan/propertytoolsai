import { NextResponse } from "next/server";
import { encodeProgrammaticPageKey, insertPerformanceSnapshot } from "@/lib/seoOptimization";
import { programmaticUrlPath } from "@/lib/seoOptimization/pageKey";

export const runtime = "nodejs";

type Body = {
  toolSlug?: string;
  locationSlug?: string;
  pageKey?: string;
  urlPath?: string;
  impressions?: number;
  ctr?: number;
  positionAvg?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  raw?: Record<string, unknown>;
};

/**
 * POST /api/seo/optimization/metrics
 * Ingest GSC-style metrics. Prefer `toolSlug` + `locationSlug` OR explicit `pageKey` (tool|slug|loc).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const toolSlug = body.toolSlug?.trim();
  const locationSlug = body.locationSlug?.trim();
  let pageKey = body.pageKey?.trim();

  if (!pageKey && toolSlug && locationSlug) {
    pageKey = encodeProgrammaticPageKey(toolSlug, locationSlug);
  }

  if (!pageKey) {
    return NextResponse.json(
      { ok: false, error: "Provide `pageKey` or `toolSlug` + `locationSlug`" },
      { status: 400 }
    );
  }

  const impressions = Number(body.impressions ?? 0);
  const ctr = Number(body.ctr ?? 0);
  if (!Number.isFinite(impressions) || impressions < 0) {
    return NextResponse.json({ ok: false, error: "Invalid impressions" }, { status: 400 });
  }
  if (!Number.isFinite(ctr) || ctr < 0 || ctr > 1) {
    return NextResponse.json({ ok: false, error: "ctr must be between 0 and 1" }, { status: 400 });
  }

  const positionAvg =
    body.positionAvg === null || body.positionAvg === undefined
      ? null
      : Number(body.positionAvg);

  if (positionAvg !== null && !Number.isFinite(positionAvg)) {
    return NextResponse.json({ ok: false, error: "Invalid positionAvg" }, { status: 400 });
  }

  const urlPath =
    body.urlPath?.trim() ||
    (toolSlug && locationSlug ? programmaticUrlPath(toolSlug, locationSlug) : null);

  const today = new Date().toISOString().slice(0, 10);
  const periodStart = (body.periodStart ?? today).toString().slice(0, 10);
  const periodEnd = (body.periodEnd ?? today).toString().slice(0, 10);

  const result = await insertPerformanceSnapshot({
    pageKey,
    urlPath: urlPath ?? undefined,
    impressions,
    ctr,
    positionAvg,
    periodStart,
    periodEnd,
    raw: body.raw ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pageKey });
}
