import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import { buildPromptForPageType } from "./prompts";
import { normalizeSnippetBlocks } from "./snippetBlocks";
import type { GeneratedSerpPage, SerpPagePayload, SerpPageType } from "./types";

function coercePayload(raw: unknown, pageType: SerpPageType): SerpPagePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const sectionsRaw = Array.isArray(p.sections) ? p.sections : [];
  const sections = sectionsRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const heading = String(o.heading ?? "").trim();
      const paras = Array.isArray(o.paragraphs) ? o.paragraphs.map((x) => String(x).trim()).filter(Boolean) : [];
      return heading && paras.length ? { heading, paragraphs: paras } : null;
    })
    .filter(Boolean) as SerpPagePayload["sections"];

  const faqsRaw = Array.isArray(p.faqs) ? p.faqs : [];
  const faqs = faqsRaw
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const o = f as Record<string, unknown>;
      const q = String(o.question ?? "").trim();
      const a = String(o.answer ?? "").trim();
      return q && a ? { question: q, answer: a } : null;
    })
    .filter(Boolean) as NonNullable<SerpPagePayload["faqs"]>;

  const cr = Array.isArray(p.comparisonRows) ? p.comparisonRows : [];
  const comparisonRows = cr
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      const a = String(o.a ?? "").trim();
      const b = String(o.b ?? "").trim();
      return label ? { label, a, b } : null;
    })
    .filter(Boolean) as NonNullable<SerpPagePayload["comparisonRows"]>;

  let toolCta: SerpPagePayload["toolCta"];
  if (p.toolCta && typeof p.toolCta === "object") {
    const t = p.toolCta as Record<string, unknown>;
    const headline = String(t.headline ?? "").trim();
    const bullets = Array.isArray(t.bullets) ? t.bullets.map((x) => String(x).trim()).filter(Boolean) : [];
    if (headline && bullets.length) toolCta = { headline, bullets };
  }

  const lede = typeof p.lede === "string" ? p.lede.trim() : undefined;

  if (pageType === "faq") {
    if (faqs.length < 5) return null;
  } else if (pageType === "comparison") {
    if (comparisonRows.length < 3 || sections.length < 1) return null;
  } else if (sections.length < 2) {
    return null;
  }

  return {
    pageType,
    lede,
    sections,
    faqs: faqs.length ? faqs : undefined,
    comparisonRows: comparisonRows.length ? comparisonRows : undefined,
    toolCta,
  };
}

export async function generateSerpPageForType(
  keyword: string,
  pageType: SerpPageType,
  clusterHint?: string
): Promise<GeneratedSerpPage | null> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return null;

  const user = buildPromptForPageType(keyword, pageType, clusterHint);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Output only valid JSON per the user schema." },
          { role: "user", content: user },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("serp dominator OpenAI", res.status, json);
      return null;
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;
    const o = JSON.parse(text) as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    const meta_description = String(o.meta_description ?? "").trim();
    const payload = coercePayload(o.payload, pageType);
    let snippet_blocks = normalizeSnippetBlocks(o.snippet_blocks);

    if (!title || !meta_description || !payload) return null;
    if (snippet_blocks.length === 0) {
      snippet_blocks = [{ type: "paragraph", text: meta_description.slice(0, 320) }];
    }

    return {
      pageType,
      title,
      meta_description,
      payload,
      snippet_blocks,
    };
  } catch (e) {
    console.warn("generateSerpPageForType", e);
    return null;
  }
}
