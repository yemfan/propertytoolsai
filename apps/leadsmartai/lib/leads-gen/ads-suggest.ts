import "server-only";

import { getAnthropicClient } from "@/lib/anthropic";

/**
 * AI-suggest helper for Lead Ad creative. Drafts a body + headline
 * pair from a free-form description of what the campaign is
 * promoting. Pairs with `/api/leads-gen/ads/suggest` and the
 * "Suggest with AI" button on Section 3 of the ad campaign wizard.
 *
 * Lead Ad body and headline have very different constraints from a
 * social-post caption:
 *   - Body: ~125 chars optimal (Meta truncates the primary text
 *     past ~90 chars on mobile feed). Should function as a hook
 *     more than a paragraph.
 *   - Headline: 27 chars on mobile, 40 chars total. Goes ABOVE
 *     the form CTA. Should be specific (address / neighborhood /
 *     headline-newsworthy fact), not a generic "Looking to buy a
 *     home?".
 *
 * Reused Anthropic client (same as draft.ts). Single model call;
 * the prompt asks for a JSON object with body + headline + a
 * couple of variant candidates the agent can pick from if they
 * don't love the first one.
 */

export type AdSuggestInput = {
  /** Plain-language brief — what the campaign is promoting, who the audience is, any hooks the agent wants featured. */
  brief: string;
  /** Optional context. Listing address, price, neighborhood — folded into the model so it doesn't invent. */
  context?: {
    propertyAddress?: string | null;
    city?: string | null;
    state?: string | null;
    listPrice?: number | null;
    listingStartDate?: string | null;
    agentName?: string | null;
    /** "new_listing", "open_house", "price_drop", etc — same vocabulary as Quick Post triggers. */
    trigger?: string | null;
  };
};

export type AdSuggestOutput = {
  /** Primary body. ~125 chars. */
  body: string;
  /** Headline. ≤ 40 chars. */
  headline: string;
  /** Up to 2 alternate body + headline pairs if the agent wants variety. */
  variants: Array<{ body: string; headline: string }>;
};

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a marketing copywriter for residential real-estate agents. You write Meta (Facebook + Instagram) Lead Ad creative — short, scroll-stopping body text + a tight headline that goes above the lead form CTA.

Voice rules:
- First-person from the agent ("I'm holding an open house…", "Just listed…"). Never refer to "the agent" or "your realtor".
- Warm, professional, concrete. Specific over generic — actual address, actual neighborhood, actual price beat "beautiful home in great area".
- Never invent details. If a fact isn't provided, omit it — don't guess.
- 0-1 emoji max, placed naturally if at all.
- Body should function as a HOOK more than a paragraph — Meta truncates past ~90 chars on mobile feed, so the first line carries the weight.
- Headline ≤ 40 chars. Specific. The headline goes directly above the lead form, so it should answer "why fill this out".

Real-estate compliance:
- Lead Ads in real estate are categorized as HOUSING — federal Fair Housing rules apply. Do NOT include any language that targets, excludes, or differentiates by race, color, religion, national origin, sex, family status, or disability.
- Avoid age-targeting language ("perfect for retirees", "starter home for young couples", etc.). Talk about the property, not the buyer.
- Avoid neighborhood characterizations that imply demographics ("up-and-coming", "trendy", "family-friendly" — all flagged by Meta).

Output format — return ONLY a JSON object, no commentary, no markdown fences:
{
  "body": "string — primary text, ~125 chars",
  "headline": "string — ≤ 40 chars",
  "variants": [
    { "body": "alternative body", "headline": "alternative headline" },
    { "body": "alternative body", "headline": "alternative headline" }
  ]
}

The "variants" array MUST contain exactly 2 entries with distinct angles (e.g. one feature-focused + one urgency / scarcity-focused).`;

export async function suggestAdCreative(
  input: AdSuggestInput,
): Promise<AdSuggestOutput> {
  const client = getAnthropicClient();

  const lines: string[] = [];
  lines.push(`Brief: ${input.brief.trim()}`);
  if (input.context) {
    const c = input.context;
    if (c.trigger) lines.push(`Campaign angle: ${c.trigger}`);
    if (c.agentName) lines.push(`Agent name: ${c.agentName}`);
    if (c.propertyAddress) lines.push(`Property address: ${c.propertyAddress}`);
    if (c.city || c.state) {
      lines.push(
        `Location: ${[c.city, c.state].filter(Boolean).join(", ")}`,
      );
    }
    if (c.listPrice != null) {
      lines.push(`List price: $${c.listPrice.toLocaleString()}`);
    }
    if (c.listingStartDate) lines.push(`Listed: ${c.listingStartDate}`);
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Ad suggest returned no text content");
  }

  return coerce(extractJsonObject(textBlock.text));
}

/**
 * Best-effort JSON extractor. Sometimes the model wraps the JSON in
 * stray prose or a markdown fence — same heuristic as draft.ts.
 */
function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = (fenced?.[1] ?? text).trim();
  // If there's leading prose, snap to the first { ... } block.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Ad suggest output is not JSON");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (e) {
    throw new Error(
      `Ad suggest output failed JSON parse: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

function coerce(raw: unknown): AdSuggestOutput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Ad suggest output is not an object");
  }
  const o = raw as Record<string, unknown>;
  const body = typeof o.body === "string" ? o.body.trim() : "";
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  if (!body) throw new Error("Ad suggest output missing body");
  if (!headline) throw new Error("Ad suggest output missing headline");

  let variants: Array<{ body: string; headline: string }> = [];
  if (Array.isArray(o.variants)) {
    variants = o.variants
      .map((v) => {
        if (!v || typeof v !== "object") return null;
        const vo = v as Record<string, unknown>;
        const vb = typeof vo.body === "string" ? vo.body.trim() : "";
        const vh = typeof vo.headline === "string" ? vo.headline.trim() : "";
        if (!vb || !vh) return null;
        return { body: vb, headline: vh };
      })
      .filter((v): v is { body: string; headline: string } => v !== null)
      .slice(0, 3);
  }

  return { body, headline, variants };
}
