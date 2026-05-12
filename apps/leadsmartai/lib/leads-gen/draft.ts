import "server-only";

import { getAnthropicClient } from "@/lib/anthropic";
import type { Trigger, SubjectDetail } from "./subjects";

/**
 * Claude-driven caption generator for the Quick Post wizard.
 *
 * One model call per draft. Returns a `{ caption, hashtags }` pair —
 * the caption is the body the agent will edit + share; the hashtags
 * are surfaced separately so the platform picker can decide whether
 * to append them (Instagram-style discovery hashtags don't help on
 * LinkedIn, etc.).
 *
 * Why platform-aware drafts: the same listing post for Facebook,
 * Instagram, LinkedIn, and X reads very differently. Long-form
 * Facebook captions land well; X is 280 chars; LinkedIn wants
 * relationship-of-trust language; IG wants hashtags + visual flair.
 * Passing `platform` into the prompt lets a single model call do
 * the right thing instead of one generic blob the agent has to
 * rewrite four times.
 */

export type Platform = "facebook" | "instagram" | "linkedin" | "x";

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  facebook:
    "Facebook: 1-3 paragraphs, conversational, friendly. End with a clear call to action. Hashtags optional, used sparingly.",
  instagram:
    "Instagram: short hook in the first line (Instagram truncates after ~125 chars), 1-2 follow-on lines, then 8-12 discovery hashtags at the end on a separate line.",
  linkedin:
    "LinkedIn: professional tone, 3-6 short lines with line breaks, frame as expertise sharing or market insight, 2-4 hashtags max at end.",
  x:
    "X (Twitter): under 280 characters total INCLUDING any hashtags. One sentence + 1-2 tasteful hashtags. Punchy.",
};

export type DraftInput = {
  trigger: Trigger;
  platform: Platform;
  subject: SubjectDetail;
  /** Free-form brief from the agent (required for "custom" trigger; optional flavor for others). */
  brief?: string | null;
  /** Agent's display name — folded into the closing CTA so the post sounds personal. */
  agentName?: string | null;
};

export type DraftOutput = {
  caption: string;
  hashtags: string[];
};

const MODEL = "claude-sonnet-4-6";

export async function generateDraftCaption(input: DraftInput): Promise<DraftOutput> {
  const client = getAnthropicClient();

  const systemPrompt = buildSystemPrompt(input.platform);
  const userPrompt = buildUserPrompt(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Draft generator returned no text content");
  }

  const json = extractJsonObject(textBlock.text);
  return coerceDraft(json);
}

function buildSystemPrompt(platform: Platform): string {
  return `You are a marketing copywriter for residential real-estate agents. You write social-media posts that the agent can copy-paste and share with minimal edits.

Voice rules:
- First-person from the agent ("I'm thrilled to share…", "Just listed in…"). Never refer to "the agent" or "your realtor".
- Warm, professional, never gimmicky. No emoji walls. 0-2 emoji max per post, placed naturally.
- Concrete details (address, price, dates, neighborhood) over generic praise. The reader should know what the post is about within the first line.
- Never invent details. If a fact wasn't provided, omit it — don't guess square footage, schools, view types, etc.
- Always end with a clear call to action ("DM me to schedule a private showing", "Comment INFO for the address", "Tap the link in bio for details", etc.).

Platform guidance:
${PLATFORM_GUIDANCE[platform]}

Output format — return ONLY a JSON object, no commentary, no markdown fences:
{
  "caption": "string — the post body the agent will share",
  "hashtags": ["array", "of", "hashtags", "without", "the", "#", "symbol"]
}

For Instagram, include hashtags at the end of the "caption" field on a separate paragraph AND in the "hashtags" array. For other platforms, omit hashtags from the caption body and only return them in the "hashtags" array.`;
}

function buildUserPrompt(input: DraftInput): string {
  const { trigger, subject, brief, agentName } = input;
  const lines: string[] = [];

  lines.push(`Trigger: ${triggerLabel(trigger)}`);
  if (agentName) lines.push(`Agent name: ${agentName}`);

  if (subject.kind === "listing") {
    lines.push("Subject: new listing");
    lines.push(`  Property: ${subject.property_address}`);
    if (subject.city || subject.state) {
      lines.push(`  Location: ${[subject.city, subject.state].filter(Boolean).join(", ")}`);
    }
    if (subject.list_price != null) {
      lines.push(`  List price: $${Number(subject.list_price).toLocaleString()}`);
    }
    if (subject.listing_start_date) {
      lines.push(`  Listed: ${subject.listing_start_date}`);
    }
    if (subject.mls_url) {
      lines.push(`  MLS link: ${subject.mls_url}`);
    }
  } else if (subject.kind === "open_house") {
    lines.push("Subject: open house");
    lines.push(`  Property: ${subject.property_address}`);
    if (subject.city || subject.state) {
      lines.push(`  Location: ${[subject.city, subject.state].filter(Boolean).join(", ")}`);
    }
    if (subject.list_price != null) {
      lines.push(`  List price: $${Number(subject.list_price).toLocaleString()}`);
    }
    lines.push(`  Start: ${formatEventTime(subject.start_at)}`);
    lines.push(`  End: ${formatEventTime(subject.end_at)}`);
    if (subject.mls_url) {
      lines.push(`  MLS link: ${subject.mls_url}`);
    }
  } else {
    lines.push("Subject: custom (no listing reference)");
  }

  if (brief?.trim()) {
    lines.push("");
    lines.push("Agent's brief / specific angle:");
    lines.push(brief.trim());
  }

  lines.push("");
  lines.push("Write the post now. Return only the JSON object.");
  return lines.join("\n");
}

function triggerLabel(t: Trigger): string {
  switch (t) {
    case "new_listing":
      return "Announce a new listing";
    case "open_house":
      return "Promote an upcoming open house";
    case "custom":
      return "Custom post";
    case "price_drop":
      return "Announce a price drop";
    case "just_sold":
      return "Celebrate a just-sold property";
    case "market_update":
      return "Share a market update";
    case "testimonial":
      return "Share a client testimonial";
  }
}

function formatEventTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : trimmed;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first < 0 || last <= first) {
    throw new Error(`Draft generator returned non-JSON: ${trimmed.slice(0, 200)}`);
  }
  try {
    return JSON.parse(body.slice(first, last + 1));
  } catch {
    throw new Error(`Draft generator returned invalid JSON: ${body.slice(first, last + 1).slice(0, 200)}`);
  }
}

function coerceDraft(raw: unknown): DraftOutput {
  if (!raw || typeof raw !== "object") {
    return { caption: "", hashtags: [] };
  }
  const r = raw as { caption?: unknown; hashtags?: unknown };
  const caption = typeof r.caption === "string" ? r.caption.trim() : "";
  const hashtags = Array.isArray(r.hashtags)
    ? r.hashtags
        .map((h) => (typeof h === "string" ? h.replace(/^#/, "").trim() : ""))
        .filter(Boolean)
    : [];
  return { caption, hashtags };
}
