import type { ExpandedKeywordRow } from "./types";

/**
 * Deterministic fallback when OpenAI is off or fails — still produces many unique rows for scoring/dedupe.
 */
export function expandSeedHeuristically(seed: string, minCount: number): ExpandedKeywordRow[] {
  const s = seed.trim();
  if (!s) return [];

  const templates: { phrase: string; intent: ExpandedKeywordRow["intent"] }[] = [
    { phrase: `${s}`, intent: "informational" },
    { phrase: `${s} guide`, intent: "informational" },
    { phrase: `${s} tips`, intent: "informational" },
    { phrase: `${s} for beginners`, intent: "informational" },
    { phrase: `what is ${s}`, intent: "informational" },
    { phrase: `how to ${s}`, intent: "informational" },
    { phrase: `why ${s} matters`, intent: "informational" },
    { phrase: `best ${s} strategies`, intent: "comparison" },
    { phrase: `${s} vs alternatives`, intent: "comparison" },
    { phrase: `${s} compared`, intent: "comparison" },
    { phrase: `${s} calculator`, intent: "tool" },
    { phrase: `free ${s} calculator`, intent: "tool" },
    { phrase: `${s} estimator`, intent: "tool" },
    { phrase: `${s} worksheet`, intent: "tool" },
    { phrase: `${s} in 2025`, intent: "informational" },
    { phrase: `${s} checklist`, intent: "informational" },
    { phrase: `${s} mistakes to avoid`, intent: "informational" },
    { phrase: `${s} step by step`, intent: "informational" },
    { phrase: `is ${s} worth it`, intent: "comparison" },
    { phrase: `${s} examples`, intent: "informational" },
    { phrase: `${s} FAQ`, intent: "informational" },
    { phrase: `how much does ${s} cost`, intent: "tool" },
    { phrase: `${s} timeline`, intent: "informational" },
    { phrase: `${s} requirements`, intent: "informational" },
    { phrase: `${s} for investors`, intent: "informational" },
    { phrase: `${s} for first time buyers`, intent: "informational" },
    { phrase: `cheap ${s} options`, intent: "comparison" },
    { phrase: `${s} near me`, intent: "informational" },
    { phrase: `online ${s} help`, intent: "informational" },
    { phrase: `${s} resources`, intent: "informational" },
  ];

  const out: ExpandedKeywordRow[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (out.length < minCount && i < 500) {
    const base = templates[i % templates.length];
    const suffix = i >= templates.length ? ` variation ${Math.floor(i / templates.length)}` : "";
    const phrase = (base.phrase + suffix).trim();
    const key = phrase.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ phrase, intent: base.intent, cluster_hint: null });
    }
    i++;
  }

  return out.slice(0, minCount);
}
