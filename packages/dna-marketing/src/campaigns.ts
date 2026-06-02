// Pure marketing-campaign primitives: audience segmentation, tone presets, and the
// parsers that turn an LLM's reply into structured copy. No I/O and no model calls —
// the app keeps the Anthropic/Resend wiring and feeds raw text through these.

// ─── Audience segmentation ──────────────────────────────────────────────────────

export type RecipientFilter = "all" | "active" | "leads" | "prospects" | "inactive";

const RECIPIENT_STATUS: Record<Exclude<RecipientFilter, "all">, string> = {
  active: "active",
  leads: "lead",
  prospects: "prospect",
  inactive: "inactive",
};

/**
 * Map a recipient filter to the `clients.status` value it targets.
 * Returns null for "all" (no status constraint).
 */
export function statusForRecipientFilter(filter: RecipientFilter): string | null {
  return filter === "all" ? null : RECIPIENT_STATUS[filter] ?? null;
}

// ─── Tone & refinement presets ──────────────────────────────────────────────────

export type CampaignTone = "promotional" | "friendly" | "professional" | "announcement";

export const CAMPAIGN_TONE: Record<CampaignTone, string> = {
  promotional: "persuasive and action-oriented, highlighting the offer with a sense of urgency",
  friendly: "warm, casual, and personable",
  professional: "polished, credible, and concise",
  announcement: "clear and informative, sharing news or an update",
};

export type RefineMode = "shorten" | "persuasive" | "casual" | "formal" | "grammar";

export const REFINE_INSTRUCTION: Record<RefineMode, string> = {
  shorten: "Make it more concise — cut to the essential message while keeping a clear call to action.",
  persuasive: "Make it more persuasive and compelling — strengthen the value proposition and the call to action.",
  casual: "Make the tone warmer, friendlier, and more conversational.",
  formal: "Make the tone more polished and professional.",
  grammar: "Fix spelling, grammar, and punctuation and improve clarity, without changing the meaning or tone.",
};

// ─── LLM-output parsers ─────────────────────────────────────────────────────────

/** Parse an LLM reply into { subject, body }, tolerating fences and stray prose. */
export function parseCampaignCopy(raw: string): { subject: string; body: string } {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  try {
    const obj = JSON.parse(t) as { subject?: unknown; body?: unknown };
    return { subject: String(obj.subject ?? "").trim(), body: String(obj.body ?? "").trim() };
  } catch {
    return { subject: "", body: raw.trim() };
  }
}

/** Parse an LLM reply into up to 5 subject lines, falling back to line parsing. */
export function parseSubjectLines(raw: string): string[] {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  try {
    const arr = JSON.parse(t);
    if (Array.isArray(arr)) {
      return arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
    }
  } catch {
    // fall through to line-based parsing
  }
  return raw
    .split("\n")
    .map((l) => l.replace(/^[\s\-*\d.)"]+/, "").replace(/"\s*,?\s*$/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}
