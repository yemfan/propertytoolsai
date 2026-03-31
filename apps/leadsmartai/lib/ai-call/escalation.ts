/** Angry / legal / fraud / sensitive — route to human review. */
const SENSITIVE = [
  /\b(lawsuit|attorney|lawyer|legal action|sue|discriminat|fair housing|hud|harass|stalk|threat)\b/i,
  /\b(fraud|scam|police|fcc|ftc)\b/i,
];

/** needs_human independent of sales “hot” intent */
export function needsHumanFromText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const re of SENSITIVE) {
    if (re.test(t)) return true;
  }
  if (/\b(angry|furious|terrible|worst|never using)\b/i.test(t) && t.length > 40) return true;
  return false;
}
