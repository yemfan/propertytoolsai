import Anthropic from "@anthropic-ai/sdk";

// Plain server module (NOT "use server") so it can be shared by webhooks, the
// dunning cron, and server actions. Uses Haiku — these are cheap, frequent calls.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5";

export type Lang = "en" | "es" | "zh";
export const SUPPORTED_LANGS: Lang[] = ["en", "es", "zh"];

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  es: "Spanish",
  zh: "Chinese (Simplified)",
};

/** Human-readable name for a language code (for prompts/UI). */
export function languageName(l: Lang): string {
  return LANG_NAME[l];
}

function firstText(res: { content: Array<{ type: string; text?: string }> }): string {
  const block = res.content[0];
  return block?.type === "text" ? (block.text ?? "").trim() : "";
}

/** Cheap shortcut: any CJK character means Chinese for our supported set. */
function looksChinese(text: string): boolean {
  return /[一-鿿]/.test(text);
}

/**
 * Detect the language of an inbound message as one of en/es/zh (fallback en).
 * Chinese is caught for free via Unicode range; en/es is disambiguated by Haiku.
 */
export async function detectLanguage(text: string): Promise<Lang> {
  const t = text.trim();
  if (!t) return "en";
  if (looksChinese(t)) return "zh";
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: `Reply with ONLY one code — en, es, or zh — for the language of this message:\n\n${t.slice(0, 500)}`,
        },
      ],
    });
    const code = firstText(res).toLowerCase();
    return (SUPPORTED_LANGS as string[]).includes(code) ? (code as Lang) : "en";
  } catch {
    return "en";
  }
}

/** Translate arbitrary text to English (for the owner to read inbound). */
export async function translateToEnglish(text: string): Promise<string | null> {
  const t = text.trim();
  if (!t) return null;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `Translate the following message to English. Return ONLY the translation, with no preamble:\n\n${t}`,
        },
      ],
    });
    return firstText(res) || null;
  } catch {
    return null;
  }
}

/**
 * Render an English source message in the target language. When bilingual, the
 * target language comes first, then the original English on a new block — so the
 * customer reads their language and the owner can still verify what went out.
 */
export async function localizeOutbound(
  englishMessage: string,
  target: Lang,
  bilingual: boolean
): Promise<string> {
  if (target === "en") return englishMessage;
  const name = LANG_NAME[target];
  const instruction = bilingual
    ? `Rewrite the message below in ${name}, then add the original English after it separated by a blank line. Return only the result, no preamble.`
    : `Rewrite the message below in ${name}. Return only the ${name} text, no preamble.`;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: `${instruction}\n\n${englishMessage}` }],
    });
    return firstText(res) || englishMessage;
  } catch {
    return englishMessage; // fall back to English rather than fail the send
  }
}
