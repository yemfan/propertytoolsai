/**
 * Search-engine indexing notifications.
 *
 * Two mechanisms:
 *
 * 1. **Google / Bing sitemap ping** – GET to the legacy ping endpoint.
 *    No API key required. Always runs.
 *
 * 2. **IndexNow** – open protocol supported by Bing, Yandex, and relayed to Google.
 *    Pushes individual URLs for crawling within minutes.
 *    Requires: INDEXNOW_KEY env var + public/<key>.txt served at the root of each site.
 *
 * Usage:
 *   await pingSearchEngines({ siteUrl, newUrls: ["https://…/slug-1", …] });
 */

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";
const GOOGLE_PING = "https://www.google.com/ping";
const BING_PING = "https://www.bing.com/ping";

export interface PingOptions {
  /** Canonical site URL, e.g. https://www.propertytoolsai.com */
  siteUrl: string;
  /** Specific new/updated URLs to push via IndexNow. */
  newUrls?: string[];
  /** Skip sitemap ping (useful when only individual URLs changed). */
  skipSitemapPing?: boolean;
}

export interface PingResult {
  sitemapPingGoogle: boolean;
  sitemapPingBing: boolean;
  indexNow: { submitted: number; ok: boolean; error?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch(
  url: string,
  init?: RequestInit,
  label = url
): Promise<boolean> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) console.warn(`[indexingPing] ${label} → HTTP ${res.status}`);
    return res.ok;
  } catch (e: unknown) {
    console.warn(`[indexingPing] ${label} failed:`, (e as Error).message ?? e);
    return false;
  }
}

// ─── 1. Sitemap ping ──────────────────────────────────────────────────────────

async function pingSitemaps(
  siteUrl: string
): Promise<{ google: boolean; bing: boolean }> {
  const sitemapUrl = encodeURIComponent(`${siteUrl.replace(/\/$/, "")}/sitemap.xml`);
  const [google, bing] = await Promise.all([
    safeFetch(`${GOOGLE_PING}?sitemap=${sitemapUrl}`, undefined, "Google ping"),
    safeFetch(`${BING_PING}?sitemap=${sitemapUrl}`, undefined, "Bing ping"),
  ]);
  return { google, bing };
}

// ─── 2. IndexNow ──────────────────────────────────────────────────────────────

async function submitIndexNow(
  siteUrl: string,
  urls: string[]
): Promise<{ submitted: number; ok: boolean; error?: string }> {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return { submitted: 0, ok: false, error: "INDEXNOW_KEY not configured" };
  if (!urls.length) return { submitted: 0, ok: true };

  const host = new URL(siteUrl).host;

  // IndexNow accepts max 10,000 URLs per call; chunk if needed.
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += 10_000) {
    chunks.push(urls.slice(i, i + 10_000));
  }

  let submitted = 0;
  for (const chunk of chunks) {
    const ok = await safeFetch(
      INDEXNOW_ENDPOINT,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${siteUrl.replace(/\/$/, "")}/${key}.txt`,
          urlList: chunk,
        }),
      },
      `IndexNow (${chunk.length} URLs)`
    );
    if (ok) submitted += chunk.length;
    else return { submitted, ok: false, error: "IndexNow HTTP error (see logs)" };
  }

  return { submitted, ok: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Notify search engines of new/updated content.
 * - Pings Google + Bing sitemap endpoint (unless skipSitemapPing).
 * - Submits individual URLs via IndexNow if INDEXNOW_KEY is set.
 */
export async function pingSearchEngines(opts: PingOptions): Promise<PingResult> {
  const { siteUrl, newUrls = [], skipSitemapPing = false } = opts;

  const [sitemapPings, indexNow] = await Promise.all([
    skipSitemapPing
      ? Promise.resolve({ google: false, bing: false })
      : pingSitemaps(siteUrl),
    submitIndexNow(siteUrl, newUrls),
  ]);

  console.log("[indexingPing] done", {
    sitemapGoogle: sitemapPings.google,
    sitemapBing: sitemapPings.bing,
    indexNow: indexNow.submitted,
  });

  return {
    sitemapPingGoogle: sitemapPings.google,
    sitemapPingBing: sitemapPings.bing,
    indexNow,
  };
}
