import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getProviderParser } from "@/lib/esign/providers";
import { recordWebhookEvent } from "@/lib/esign/service";
import type { ESignProvider } from "@/lib/esign/types";

/**
 * Generic e-signature webhook receiver. The path segment selects
 * the parser:
 *   POST /api/webhooks/esign/dotloop
 *   POST /api/webhooks/esign/docusign
 *   POST /api/webhooks/esign/hellosign
 *
 * Each parser owns its provider's signature-verification scheme +
 * payload shape. The route is uniform — verify, parse, record,
 * 200.
 *
 * Always 200s on:
 *   - unknown provider (frontend mistake or stale provider URL)
 *   - parser-rejected payload (unrecognized event, missing
 *     envelope id) — prevents retry storms
 *   - envelope not found in DB (provider sent a webhook for an
 *     envelope created outside this app)
 *
 * 401 only on signature failure with a configured secret.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const parser = getProviderParser(provider);
  if (!parser) {
    return NextResponse.json({ ok: true, ignored: "unknown_provider" });
  }

  const rawBody = await req.text();
  const h = await headers();
  const headerMap: Record<string, string> = {};
  h.forEach((v, k) => {
    headerMap[k] = v;
  });

  if (!parser.verifySignature({ rawBody, headers: headerMap })) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true, ignored: "bad_json" });
  }

  const parsed = parser.parseEvent(payload);
  if (!parsed) {
    return NextResponse.json({ ok: true, ignored: "unrecognized_event" });
  }

  try {
    const result = await recordWebhookEvent({
      provider: provider as ESignProvider,
      parsed,
    });
    if (!result) {
      return NextResponse.json({ ok: true, ignored: "envelope_not_found" });
    }
    return NextResponse.json({
      ok: true,
      envelopeId: result.envelopeId,
      status: result.status,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
