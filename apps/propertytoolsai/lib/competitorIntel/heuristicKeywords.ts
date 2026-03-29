import type { ExtractedKeyword } from "./types";

/**
 * Fallback when OpenAI is unavailable: n-grams from title + headings.
 */
export function extractKeywordsHeuristic(input: {
  title: string | null;
  headings: string[];
}): ExtractedKeyword[] {
  const chunks: string[] = [];
  if (input.title) chunks.push(input.title);
  chunks.push(...input.headings.slice(0, 8));
  const text = chunks.join(" . ").toLowerCase();
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "your", "our", "are", "was", "has", "have", "how", "what", "when", "why", "you", "can", "get", "all", "any", "but", "not", "use", "may", "more", "new", "now", "one", "out", "see", "way", "who", "its", "into", "than", "then", "them", "these", "also", "just", "like", "make", "most", "some", "such", "very", "here", "home", "page", "site",
  ]);

  const words = text.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  const out: ExtractedKeyword[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push({ phrase, intent: "informational", relevance: 45 });
    if (out.length >= 25) break;
  }

  return out;
}
