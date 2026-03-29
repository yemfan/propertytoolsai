import { NextResponse } from "next/server";
import { runOptimizationForPageKey, runWeeklyBatch } from "@/lib/seoOptimization";
import { encodeProgrammaticPageKey } from "@/lib/seoOptimization/pageKey";

export const runtime = "nodejs";

type Body = {
  pageKey?: string;
  toolSlug?: string;
  locationSlug?: string;
  force?: boolean;
  batch?: boolean;
  limit?: number;
};

/**
 * POST /api/seo/optimization/run
 * Run the AI optimizer for one page or a weekly-style batch.
 * Requires OPENAI_API_KEY + SUPABASE for persistence.
 */
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.batch) {
    const out = await runWeeklyBatch({
      limit: body.limit,
      force: Boolean(body.force),
    });
    return NextResponse.json({ ok: true, ...out });
  }

  const toolSlug = body.toolSlug?.trim();
  const locationSlug = body.locationSlug?.trim();
  let pageKey = body.pageKey?.trim();

  if (!pageKey && toolSlug && locationSlug) {
    pageKey = encodeProgrammaticPageKey(toolSlug, locationSlug);
  }

  if (!pageKey) {
    return NextResponse.json(
      { ok: false, error: "Provide `pageKey` or `toolSlug` + `locationSlug`, or `batch: true`" },
      { status: 400 }
    );
  }

  const result = await runOptimizationForPageKey(pageKey, { force: Boolean(body.force) });
  return NextResponse.json({ ok: result.status !== "failed", result });
}
