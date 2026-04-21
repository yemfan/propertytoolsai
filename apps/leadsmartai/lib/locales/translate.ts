/**
 * On-demand message translation for the agent-facing inbox.
 *
 * Use case: a Chinese-preferred lead sends the agent a reply. The agent's
 * UI is English (or Chinese — doesn't matter here). The agent clicks
 * "Translate" on that message bubble and sees an English rendering without
 * changing the original row in the database. This is NOT the path that
 * drafts outbound AI replies — those compose the reply natively in the
 * target language via the system prompt's tone directive.
 *
 * Design:
 *   - Generic: `translateText(text, { targetLocale, sourceLocale? })`. Any
 *     pair of locales works; no zh-specific code path.
 *   - Cached by `(sha256(text), sourceLocale|null, targetLocale)`. A single
 *     message translated once stays cached per row's lifetime.
 *   - Never inline-translates via the DB — the cache is a sidecar table so
 *     messages_{sms,email} rows stay untouched.
 *
 * Provider:
 *   OpenAI `responses.create` with a terse system instruction. Kept inline
 *   here (rather than routed through the existing `lib/ai/aiService.ts`
 *   wrapper) because translation is stateless, short-lived, and should
 *   never be subject to per-agent personality layers or style notes —
 *   those are for composing net-new messages, not for faithfully rendering
 *   an existing one into another language.
 */

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { coerceLocale, getLocale, type LocaleId } from "./registry";

/**
 * The row shape we expect in the `message_translation_cache` table.
 * See the accompanying migration.
 */
export type TranslationCacheRow = {
  text_hash: string;
  source_locale: string | null;
  target_locale: string;
  translated_text: string;
  created_at: string;
};

/**
 * Back-ends used by `translateText`. Real callers inject a Supabase-backed
 * implementation; unit tests inject fakes. Keeping this as a parameter
 * rather than a module-scoped singleton is what lets the tests drive the
 * cache behavior without standing up a DB.
 */
export type TranslationDeps = {
  lookup: (key: {
    textHash: string;
    sourceLocale: string | null;
    targetLocale: string;
  }) => Promise<TranslationCacheRow | null>;
  store: (row: Omit<TranslationCacheRow, "created_at">) => Promise<void>;
  /** Returns the translated text string. Invoked only on cache miss. */
  generate: (args: {
    text: string;
    sourceLocale: string | null;
    targetLocale: string;
  }) => Promise<string>;
};

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function translateText(
  text: string,
  opts: {
    targetLocale: LocaleId;
    sourceLocale?: LocaleId | null;
    deps: TranslationDeps;
  },
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const targetLocale = coerceLocale(opts.targetLocale);
  const sourceLocale = opts.sourceLocale == null ? null : coerceLocale(opts.sourceLocale);

  // Degenerate: translating en → en (or any X → X) is the identity.
  if (sourceLocale === targetLocale) return trimmed;

  const textHash = hashText(trimmed);
  const hit = await opts.deps.lookup({ textHash, sourceLocale, targetLocale });
  if (hit) return hit.translated_text;

  const translated = await opts.deps.generate({
    text: trimmed,
    sourceLocale,
    targetLocale,
  });

  await opts.deps.store({
    text_hash: textHash,
    source_locale: sourceLocale,
    target_locale: targetLocale,
    translated_text: translated,
  });

  return translated;
}

/**
 * Default `generate` implementation. Calls OpenAI with a minimal system
 * instruction tailored to "translate faithfully, no interpretation."
 *
 * Returned as a factory so callers can wrap / replace the OpenAI client
 * (tests, mocking, alt providers).
 */
export function makeOpenAiTranslator(opts?: { apiKey?: string; model?: string }) {
  const apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    // Returning a stub that throws on use keeps type signatures clean while
    // ensuring a misconfigured deploy fails loudly the first time the user
    // clicks Translate, not silently.
    return async () => {
      throw new Error("OPENAI_API_KEY is not configured for translateText.");
    };
  }
  const client = new OpenAI({ apiKey });
  const model = opts?.model ?? process.env.OPENAI_TRANSLATION_MODEL?.trim() ?? "gpt-4o-mini";

  return async (args: { text: string; sourceLocale: string | null; targetLocale: string }): Promise<string> => {
    const target = getLocale(coerceLocale(args.targetLocale));
    const sourceHint = args.sourceLocale ? getLocale(coerceLocale(args.sourceLocale)).label : "auto-detect";

    const instructions = [
      "You are a translation engine for a real-estate CRM.",
      `Translate the user's message into ${target.label} (BCP-47 ${target.bcp47}).`,
      `The source language is: ${sourceHint}.`,
      "Preserve meaning, names, addresses, numbers, and currency symbols exactly.",
      "Do NOT add commentary, explanations, or quote marks around the output.",
      "Output ONLY the translated text.",
    ].join("\n");

    const response = await client.responses.create({
      model,
      instructions,
      input: [{ role: "user", content: args.text }],
    });

    const out = response.output_text?.trim();
    if (!out) throw new Error("Translation provider returned empty output.");
    return out;
  };
}
