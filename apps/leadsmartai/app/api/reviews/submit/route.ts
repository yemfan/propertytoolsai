import { NextResponse } from "next/server";
import { recordResponse } from "@/lib/reviews/service";

/**
 * Public review-submit endpoint. The landing page at
 * /review/[token] POSTs here with the visitor's rating + comment.
 *
 * Auth: token-based. Anyone with a valid raw token can submit
 * once. Status codes:
 *   200 — recorded
 *   400 — malformed body
 *   404 — token doesn't match any request, expired, or already
 *         responded (collapsed to keep the surface tight)
 */
export async function POST(req: Request) {
  let payload: {
    token?: string;
    rating?: number | null;
    body?: string;
    authorName?: string | null;
    authorTitle?: string | null;
  };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const token = (payload.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  // Validate rating range up front so we don't insert a bad row.
  const rating = payload.rating;
  if (rating != null) {
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return NextResponse.json(
        { ok: false, error: "Rating must be 1–5" },
        { status: 400 },
      );
    }
  }

  const result = await recordResponse({
    rawToken: token,
    rating: rating ?? null,
    body: payload.body ?? "",
    authorName: payload.authorName ?? null,
    authorTitle: payload.authorTitle ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "invalid_or_used" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, testimonialId: result.testimonialId });
}
