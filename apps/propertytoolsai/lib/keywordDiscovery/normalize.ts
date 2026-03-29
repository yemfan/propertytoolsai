/**
 * Canonical form for deduplication: lowercase, trim, collapse whitespace, strip trailing punctuation noise.
 */
export function normalizeKeywordForDedupe(input: string): string {
  let s = String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  s = s.replace(/[?.!,;:]+$/g, "").trim();
  return s;
}

export function displayKeyword(input: string): string {
  const n = normalizeKeywordForDedupe(input);
  if (!n) return "";
  return n.replace(/\b\w/g, (c) => c.toUpperCase());
}
