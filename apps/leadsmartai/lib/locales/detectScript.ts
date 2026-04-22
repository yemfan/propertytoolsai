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

/**
 * Classify an inbound message body to a supported outbound locale id.
 * Used by the SMS + email inbound webhooks to auto-set
 * `contacts.preferred_language` on first receipt when the contact has
 * no explicit preference yet.
 *
 * The decision rule is deliberately simple and conservative:
 *   - If the text contains any CJK Han character → 'zh'
 *   - Otherwise → 'en'
 *
 * This is fine for the current two-language world (en + zh). When a
 * third non-Latin-script language is added (ja, ko, ar) we'll need a
 * multi-way classifier — LLM one-shot via the existing AI call is the
 * natural next step, and the return type stays the same so callers
 * don't need to change.
 *
 * Returns a string rather than `LocaleId` so a caller can compare
 * against arbitrary `preferred_language` values without importing the
 * registry type, but the output is guaranteed to be one of the
 * outbound-enabled locale ids.
 */
export function classifyInboundLanguage(text: string): "en" | "zh" {
  if (text && containsCjk(text)) return "zh";
  return "en";
}
