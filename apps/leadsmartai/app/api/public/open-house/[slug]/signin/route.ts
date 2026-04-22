import { NextResponse } from "next/server";
import { recordPublicSignin, type PublicSigninInput } from "@/lib/open-houses/publicService";

export const runtime = "nodejs";

/**
 * POST /api/public/open-house/[slug]/signin
 *
 * Unauthenticated. The slug is the only auth — treat it as a
 * capability token. Writes a visitor row; conditionally upserts a
 * CRM contact (see publicService.recordPublicSignin for the policy).
 *
 * Light rate-limit/bot protection is deliberately left as a
 * follow-up. Abuse surface is dumping junk visitors to an agent's
 * open house — annoying, not dangerous. If that becomes a real
 * problem, add hCaptcha or simple IP-based throttling here.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<
      Omit<PublicSigninInput, "slug">
    >;

    const result = await recordPublicSignin({
      slug,
      name: asNullableString(body.name),
      email: asNullableString(body.email),
      phone: asNullableString(body.phone),
      isBuyerAgented: Boolean(body.isBuyerAgented),
      buyerAgentName: asNullableString(body.buyerAgentName),
      buyerAgentBrokerage: asNullableString(body.buyerAgentBrokerage),
      timeline:
        body.timeline &&
        ["now", "3_6_months", "6_12_months", "later", "just_looking"].includes(
          body.timeline,
        )
          ? (body.timeline as PublicSigninInput["timeline"])
          : null,
      buyerStatus:
        body.buyerStatus &&
        ["looking", "just_browsing", "neighbor", "other"].includes(body.buyerStatus)
          ? (body.buyerStatus as PublicSigninInput["buyerStatus"])
          : null,
      marketingConsent: Boolean(body.marketingConsent),
      notes: asNullableString(body.notes),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

function asNullableString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}
