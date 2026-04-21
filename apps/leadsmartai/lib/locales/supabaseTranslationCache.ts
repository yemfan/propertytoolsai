/**
 * Supabase-backed implementation of {@link TranslationDeps}.
 *
 * Table: `message_translation_cache` (see the 20260483000000 migration).
 * Key: (text_hash, source_locale, target_locale). Source may be NULL; PG15+
 * uses the NULLS-NOT-DISTINCT unique index to dedupe on repeat inserts, and
 * older clusters lean on ON-CONFLICT logic below.
 *
 * Kept in its own file — not co-located with `translate.ts` — so unit tests
 * of `translateText` can inject fakes without pulling in a Supabase client.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  makeOpenAiTranslator,
  type TranslationCacheRow,
  type TranslationDeps,
} from "./translate";

export function createSupabaseTranslationDeps(): TranslationDeps {
  const generate = makeOpenAiTranslator();

  return {
    async lookup({ textHash, sourceLocale, targetLocale }) {
      // Supabase JS's `.is("source_locale", null)` handles NULL correctly;
      // `.eq` would return zero rows for null-keyed cache entries.
      let q = supabaseAdmin
        .from("message_translation_cache")
        .select("text_hash, source_locale, target_locale, translated_text, created_at")
        .eq("text_hash", textHash)
        .eq("target_locale", targetLocale);

      q = sourceLocale == null ? q.is("source_locale", null) : q.eq("source_locale", sourceLocale);

      const { data, error } = await q.maybeSingle();
      if (error || !data) return null;
      return data as TranslationCacheRow;
    },

    async store(row) {
      // ON CONFLICT DO NOTHING via `upsert({ ignoreDuplicates: true })`.
      // Covers both the PG15 nulls-not-distinct case and older clusters
      // where a raced insert might otherwise raise a unique-violation.
      const { error } = await supabaseAdmin
        .from("message_translation_cache")
        .upsert(row as never, { ignoreDuplicates: true });
      if (error) {
        // Non-fatal — a failed cache write just means the next call
        // regenerates. Log so ops notices if it's a recurring pattern.
        console.error("[translationCache.store] failed:", error.message);
      }
    },

    generate,
  };
}
