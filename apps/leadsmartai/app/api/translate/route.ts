/**
 * POST /api/translate — on-demand message translation for the inbox toggle.
 *
 * Used by the agent-facing conversation panels when they want to see a
 * Chinese (or other non-English) SMS/email message rendered into English
 * (or vice-versa). Results are cached in `message_translation_cache`
 * keyed by sha256(text), so the same message translated across sessions
 * only hits the LLM once.
 *
 * Auth: same session/auth assumptions as the rest of the agent dashboard.
 * There's no secret-token gate here because this is an authenticated-user
 * feature, not an automation endpoint — the app's existing session
 * middleware covers access control. A future hardening pass could add
 * rate-limiting by user id if abuse surfaces.
 *
 * Body:
 *   { text: string, targetLocale: "en" | "zh", sourceLocale?: "en" | "zh" }
 *
 * Response:
 *   { ok: true, translated: string, targetLocale, sourceLocale? }
 */

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import {
  coerceLocale,
  isSupportedLocale,
  type LocaleId,
} from "@/lib/locales/registry";
import { createSupabaseTranslationDeps } from "@/lib/locales/supabaseTranslationCache";
import { translateText } from "@/lib/locales/translate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestBody = {
  text?: unknown;
  targetLocale?: unknown;
  sourceLocale?: unknown;
};

export async function POST(req: Request) {
  // Authenticated users only. This endpoint hits the LLM (costs money)
  // and reveals translated message content; it should never be open to
  // anonymous callers. The app's proxy middleware does NOT cover /api/*
  // routes — we gate here explicitly.
  const user = await getUserFromRequest(req);
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body is not valid JSON." },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing or empty text." },
      { status: 400 },
    );
  }

  // Hard cap on input length — this endpoint translates chat messages, not
  // documents. Anything longer is likely a bug or abuse.
  const MAX_INPUT = 4_000;
  if (text.length > MAX_INPUT) {
    return NextResponse.json(
      { ok: false, error: `Text exceeds ${MAX_INPUT} chars.` },
      { status: 413 },
    );
  }

  if (!isSupportedLocale(body.targetLocale)) {
    return NextResponse.json(
      { ok: false, error: "targetLocale must be a supported locale id." },
      { status: 400 },
    );
  }

  const targetLocale: LocaleId = body.targetLocale;
  const sourceLocale: LocaleId | null =
    body.sourceLocale == null
      ? null
      : isSupportedLocale(body.sourceLocale)
        ? coerceLocale(body.sourceLocale)
        : null;

  try {
    const translated = await translateText(text, {
      targetLocale,
      sourceLocale,
      deps: createSupabaseTranslationDeps(),
    });
    return NextResponse.json({
      ok: true,
      translated,
      targetLocale,
      sourceLocale,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/translate] failed:", message);
    return NextResponse.json(
      { ok: false, error: "Translation failed. Try again." },
      { status: 502 },
    );
  }
}
