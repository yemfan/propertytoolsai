import type { KeywordIntent } from "./types";

const INTENT_WEIGHT: Record<KeywordIntent, number> = {
  informational: 1.15,
  tool: 1.25,
  comparison: 1.1,
};

/**
 * Heuristic score 0–100: length fit, seed overlap, intent, word count.
 */
export function scoreKeyword(input: {
  phrase: string;
  sourceSeed: string;
  intent: KeywordIntent;
}): number {
  const phrase = input.phrase.trim();
  const seed = input.sourceSeed.toLowerCase().trim();
  const p = phrase.toLowerCase();

  let score = 40;

  const words = p.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && words.length <= 12) score += 12;
  else if (words.length >= 2) score += 6;
  else score -= 5;

  if (p.length > 80) score -= 8;
  if (p.length < 8) score -= 10;

  const seedTokens = seed.split(/\s+/).filter((w) => w.length > 2);
  let overlap = 0;
  for (const t of seedTokens) {
    if (p.includes(t)) overlap += 4;
  }
  score += Math.min(overlap, 20);

  if (p.includes(seed)) score += 15;

  score *= INTENT_WEIGHT[input.intent] ?? 1;

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
