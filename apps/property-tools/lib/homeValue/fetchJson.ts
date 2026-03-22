/**
 * fetch() + JSON parse with a clear error when the server returns HTML (404 page, error boundary, etc.).
 * Avoids: "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"
 */
export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ res: Response; data: T }> {
  const res = await fetch(input, init);
  const ct = res.headers.get("content-type") ?? "";
  const looksJson =
    ct.includes("application/json") ||
    ct.includes("text/json") ||
    ct.includes("+json");
  if (!looksJson) {
    const text = await res.text();
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 200);
    const msg =
      res.status === 404
        ? "API route not found (404 — server returned HTML). Restart the dev server or confirm you’re on the Property Tools app origin."
        : `Expected JSON but got HTTP ${res.status} (${preview})`;
    throw new Error(msg);
  }
  const data = (await res.json()) as T;
  return { res, data };
}
