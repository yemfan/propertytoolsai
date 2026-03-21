import { normalizeKeywordForDedupe } from "./normalize";
import type { KeywordCandidate } from "./types";

/**
 * Keeps highest score when duplicate normalized form appears.
 */
export function dedupeCandidates(
  items: KeywordCandidate[],
  existingNormalized?: Set<string>
): KeywordCandidate[] {
  const map = new Map<string, KeywordCandidate>();

  for (const c of items) {
    const key = c.normalized_keyword;
    if (existingNormalized?.has(key)) continue;

    const prev = map.get(key);
    if (!prev || c.score > prev.score) {
      map.set(key, c);
    }
  }

  return Array.from(map.values());
}

export function mergeWithExistingPreferHigher(
  incoming: KeywordCandidate[],
  existing: Map<string, number>
): KeywordCandidate[] {
  const out: KeywordCandidate[] = [];
  for (const c of incoming) {
    const prevScore = existing.get(c.normalized_keyword);
    if (prevScore != null && c.score <= prevScore) continue;
    out.push(c);
  }
  return out;
}

export function normalizedSetFromPhrases(phrases: string[]): Set<string> {
  const s = new Set<string>();
  for (const p of phrases) {
    const n = normalizeKeywordForDedupe(p);
    if (n) s.add(n);
  }
  return s;
}
