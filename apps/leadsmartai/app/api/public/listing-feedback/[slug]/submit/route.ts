import { NextResponse } from "next/server";
import {
  submitPublicFeedback,
  type PublicSubmitInput,
} from "@/lib/listing-feedback/publicService";

export const runtime = "nodejs";

/**
 * POST /api/public/listing-feedback/[slug]/submit
 *   Unauthenticated. Slug is the capability. One submit per slug —
 *   subsequent attempts return a friendly "already submitted" error.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<
      Omit<PublicSubmitInput, "slug">
    >;

    const result = await submitPublicFeedback({
      slug,
      rating: typeof body.rating === "number" ? body.rating : null,
      overallReaction:
        body.overallReaction &&
        ["love", "like", "maybe", "pass"].includes(body.overallReaction)
          ? (body.overallReaction as PublicSubmitInput["overallReaction"])
          : null,
      pros: asNullableString(body.pros),
      cons: asNullableString(body.cons),
      priceFeedback:
        body.priceFeedback &&
        ["too_high", "about_right", "bargain"].includes(body.priceFeedback)
          ? (body.priceFeedback as PublicSubmitInput["priceFeedback"])
          : null,
      wouldOffer: typeof body.wouldOffer === "boolean" ? body.wouldOffer : null,
      notes: asNullableString(body.notes),
    });

    if (result.ok === false) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST public listing-feedback submit:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function asNullableString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}
