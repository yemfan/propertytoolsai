import type { ScrapedPage } from "./types";

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m?.[1]) return stripTags(m[1]).trim() || null;
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return stripTags(og[1]).trim() || null;
  return null;
}

function extractHeadings(html: string, maxLevel = 3): string[] {
  const out: string[] = [];
  const re = new RegExp(`<h([1-${maxLevel}])[^>]*>([\\s\\S]*?)<\\/h\\1>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[2] ?? "").trim();
    if (text && text.length < 500) out.push(text);
  }
  return out.slice(0, 40);
}

/**
 * Lightweight HTML extraction (no cheerio) — good for most marketing pages.
 */
export function parseHtmlToScrapedPage(url: string, html: string, excerptMaxChars = 12000): ScrapedPage {
  const title = extractTitle(html);
  const headings = extractHeadings(html);
  const body = stripTags(html);
  const textExcerpt = body.slice(0, excerptMaxChars);
  return {
    url,
    title,
    headings,
    textExcerpt,
    textChars: body.length,
  };
}

export async function fetchPageHtml(url: string, timeoutMs = 20000): Promise<{ html: string | null; status: number; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "PropertyToolsAI-CompetitorBot/1.0 (+https://propertytools.ai)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    const status = res.status;
    if (!res.ok) return { html: null, status, error: `HTTP ${status}` };
    const html = await res.text();
    return { html, status };
  } catch (e) {
    console.warn("fetchPageHtml", url, e);
    return { html: null, status: 0, error: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}
