/** Best-effort US ZIP extraction from a single-line address. */
export function extractUsZipFromAddress(text: string): string | null {
  const m = String(text ?? "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1]! : null;
}
