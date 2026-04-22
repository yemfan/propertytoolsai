import "server-only";

import { getAnthropicClient } from "@/lib/anthropic";
import type { ListingActivitySnapshot, SellerCommentary } from "./types";

/**
 * Turns the weekly activity snapshot into a short, seller-facing
 * commentary block. Claude acts as the listing agent's co-author —
 * data-backed, honest, never spins bad weeks as good.
 *
 * If AI is unavailable (no API key, credits out, parser fail), the
 * email still sends with a baseline fallback. That's important:
 * sellers expect their Monday email. A broken Claude call shouldn't
 * kill the delivery.
 */

const SYSTEM_PROMPT = `You are a licensed California real-estate agent writing a weekly update to your seller client.

Your job:
- Read a JSON snapshot of the past week's activity on their listing.
- Produce a compact 4-part JSON response (summary, observations, recommendation, suggestsPriceReduction).
- Write in plain, honest English. Sellers want transparency, not spin.
- Reference specific numbers from the snapshot — "3 visitors this week, 0 from actively-looking buyers."
- Never fabricate data not present in the input.
- If activity is low and the listing has been active 21+ days, a price-reduction recommendation is often right. Be direct but not alarmist.
- If activity is healthy and they already have offers, say so — don't manufacture urgency.
- Tone: confident, plain-spoken, like a seasoned agent who tells clients the truth. Not chipper, not corporate.`;

const SCHEMA = `Return JSON with this exact shape. No prose, no markdown, no code fences:

{
  "summary": "string",                     // 1-2 sentence market summary, ≤280 chars
  "observations": ["string", ...],         // 2-3 data-backed observations, each ≤200 chars
  "recommendation": "string",              // 1 imperative sentence, ≤200 chars
  "suggestsPriceReduction": boolean        // true if the recommendation IS a price reduction
}`;

export async function generateSellerCommentary(
  snapshot: ListingActivitySnapshot,
): Promise<SellerCommentary> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Snapshot of listing activity:\n\n${JSON.stringify(snapshot, null, 2)}\n\n${SCHEMA}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Commentary returned no text");
  }
  return parseCommentaryResponse(textBlock.text);
}

/**
 * Tolerant parser — strips code fences, coerces missing fields to safe
 * defaults. Exported for unit-testing without hitting the API.
 */
export function parseCommentaryResponse(raw: string): SellerCommentary {
  const stripped = stripFences(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Commentary response was not valid JSON: ${raw.slice(0, 200)}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Commentary response was not an object");
  }
  const p = parsed as Record<string, unknown>;
  return {
    summary: truncate(asString(p.summary) || "", 500),
    observations: asStringArray(p.observations).slice(0, 3).map((s) => truncate(s, 300)),
    recommendation: truncate(asString(p.recommendation) || "", 300),
    suggestsPriceReduction: Boolean(p.suggestsPriceReduction),
  };
}

/**
 * Baseline fallback when Claude is unavailable. Keeps the Monday email
 * going — agents who rely on this feature must see SOMETHING arrive
 * every week, or the feature loses trust.
 */
export function buildFallbackCommentary(
  snapshot: ListingActivitySnapshot,
): SellerCommentary {
  const dom = snapshot.daysOnMarket ?? null;
  const offers = snapshot.offersReceivedCount;
  const visitors = snapshot.visitorsTotal;

  const observations: string[] = [];
  if (visitors === 0 && offers === 0) {
    observations.push(
      "No activity to report this week. We may need to look at where the listing is being promoted.",
    );
  } else {
    if (visitors > 0) {
      observations.push(`${visitors} visitor${visitors === 1 ? "" : "s"} signed in this week.`);
    }
    if (offers > 0) {
      observations.push(`${offers} offer${offers === 1 ? "" : "s"} received this week.`);
    }
  }

  let recommendation = "Let's connect this week to talk about next steps.";
  let suggestsPriceReduction = false;
  if (dom != null && dom >= 21 && offers === 0) {
    recommendation =
      "We've been on the market three weeks with no offers. Let's discuss whether a price adjustment makes sense.";
    suggestsPriceReduction = true;
  }

  return {
    summary:
      visitors === 0 && offers === 0
        ? "Quiet week on the listing."
        : `${visitors} visitor${visitors === 1 ? "" : "s"} + ${offers} offer${offers === 1 ? "" : "s"} this week.`,
    observations,
    recommendation,
    suggestsPriceReduction,
  };
}

function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1] : s;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0) as string[];
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
