import { originFromDomain } from "./domain";

const MAX_SITEMAP_DEPTH = 3;

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc[^>]*>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1]?.trim();
    if (u) out.push(u);
  }
  return out;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "PropertyToolsAI-CompetitorBot/1.0 (+https://propertytools.ai)",
        Accept: "application/xml,text/xml,*/*",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resolves sitemap URL(s) and returns page URLs (deduped, same host preferred).
 */
export async function discoverSitemapUrls(
  domain: string,
  options?: { maxUrls?: number; timeoutMs?: number; delayMs?: number }
): Promise<string[]> {
  const origin = originFromDomain(domain);
  const maxUrls = Math.min(options?.maxUrls ?? 200, 5000);
  const timeoutMs = options?.timeoutMs ?? 20000;
  const delayMs = options?.delayMs ?? 200;

  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];

  const seen = new Set<string>();
  const pageUrls: string[] = [];

  async function visitSitemapXml(url: string, depth: number): Promise<void> {
    if (depth > MAX_SITEMAP_DEPTH || pageUrls.length >= maxUrls) return;

    const xml = await fetchText(url, timeoutMs);
    if (!xml) return;

    if (isSitemapIndex(xml)) {
      const locs = extractLocs(xml);
      for (const loc of locs) {
        if (pageUrls.length >= maxUrls) break;
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        await visitSitemapXml(loc, depth + 1);
      }
      return;
    }

    const locs = extractLocs(xml);
    for (const loc of locs) {
      if (pageUrls.length >= maxUrls) break;
      if (!/^https?:\/\//i.test(loc)) continue;
      if (seen.has(loc)) continue;
      seen.add(loc);
      if (loc.includes(".xml")) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        await visitSitemapXml(loc, depth + 1);
      } else {
        pageUrls.push(loc);
      }
    }
  }

  let started = false;
  for (const u of candidates) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    const xml = await fetchText(u, timeoutMs);
    if (xml && (xml.includes("<urlset") || xml.includes("<sitemapindex") || xml.includes("<loc>"))) {
      started = true;
      await visitSitemapXml(u, 0);
      break;
    }
  }

  if (!started && pageUrls.length === 0) {
    pageUrls.push(origin, `${origin}/`, `${origin}/blog`);
  }

  return pageUrls.slice(0, maxUrls);
}
