import type { KeywordIntent } from "./types";

const INTENTS: KeywordIntent[] = ["tool", "informational", "comparison"];

export function parseIntent(raw: unknown): KeywordIntent | null {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (s === "tool" || s === "informational" || s === "comparison") return s;
  return null;
}

export function classifyIntentHeuristic(phrase: string): KeywordIntent {
  const p = phrase.toLowerCase();
  if (
    /\b(vs\.?|versus|compare|comparison|or better|or cheaper)\b/.test(p) ||
    /\b(best vs|difference between)\b/.test(p)
  ) {
    return "comparison";
  }
  if (
    /\b(calculator|calc|estimate|estimator|tool|spreadsheet|worksheet)\b/.test(p) ||
    /\bhow much (can|should|do i)\b/.test(p)
  ) {
    return "tool";
  }
  return "informational";
}

export function isValidIntent(s: string): s is KeywordIntent {
  return INTENTS.includes(s as KeywordIntent);
}
