/**
 * Extremely cheap "does this text look CJK?" check used by the inbox panels
 * to decide whether to render a `<TranslationToggle>` underneath a message.
 *
 * We deliberately keep this low-effort, client-side, and conservative:
 *   - only CJK Unified Ideographs + Kangxi Radicals ranges
 *   - any single such char flips the result to true
 *
 * False-negatives (romanized pinyin, zh mixed with English) still render
 * without the toggle, which is the right default — the agent can read the
 * Latin text directly.
 *
 * Full language detection (franc / cld3 / LLM) is NOT done here because
 * this runs on every message render in the conversation panel and the
 * overhead isn't worth the precision. If we ever need to set
 * `leads.preferred_language` automatically from an inbound message,
 * the actual detection lives server-side in a separate helper.
 */

// CJK Unified Ideographs: U+4E00–U+9FFF
// CJK Unified Ideographs Extension A: U+3400–U+4DBF
// CJK Compatibility Ideographs: U+F900–U+FAFF
const CJK_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

/** True if the string contains any CJK Han character. */
export function containsCjk(text: string): boolean {
  return CJK_RE.test(text);
}

/**
 * Heuristic: the message is "likely non-English enough to offer a
 * translate toggle" to the English-reading agent. Keep this callable
 * without a loaded locale registry — it runs on every message render.
 */
export function shouldOfferTranslationToEnglish(text: string): boolean {
  if (!text) return false;
  return containsCjk(text);
}
