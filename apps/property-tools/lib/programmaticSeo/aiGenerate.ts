import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { ProgrammaticSeoLocation, ProgrammaticSeoPayload, ProgrammaticSeoTool } from "./types";

type AiShape = {
  insights: string[];
  sections: { heading: string; paragraphs: string[] }[];
  faqs: { question: string; answer: string }[];
};

function normalizePayload(raw: unknown): ProgrammaticSeoPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const insights = Array.isArray(o.insights) ? o.insights.map((x) => String(x).trim()).filter(Boolean) : [];
  const faqsRaw = Array.isArray(o.faqs) ? o.faqs : [];
  const faqs = faqsRaw
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const q = String((f as Record<string, unknown>).question ?? "").trim();
      const a = String((f as Record<string, unknown>).answer ?? "").trim();
      return q && a ? { question: q, answer: a } : null;
    })
    .filter(Boolean) as { question: string; answer: string }[];

  const secRaw = Array.isArray(o.sections) ? o.sections : [];
  const sections = secRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const heading = String((s as Record<string, unknown>).heading ?? "").trim();
      const paras = (s as Record<string, unknown>).paragraphs;
      const paragraphs = Array.isArray(paras)
        ? paras.map((p) => String(p).trim()).filter(Boolean)
        : [];
      return heading && paragraphs.length ? { heading, paragraphs } : null;
    })
    .filter(Boolean) as { heading: string; paragraphs: string[] }[];

  if (insights.length < 2 || sections.length < 3 || faqs.length < 5) return null;
  return { insights, sections, faqs, source: "ai" };
}

/**
 * Generates structured SEO content via OpenAI. Returns null if unavailable or invalid.
 */
export async function generateProgrammaticSeoWithAi(
  tool: ProgrammaticSeoTool,
  loc: ProgrammaticSeoLocation
): Promise<ProgrammaticSeoPayload | null> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return null;

  const place = `${loc.city}, ${loc.state}`;
  const prompt = `You are an SEO copywriter for PropertyTools AI (real estate calculators).

Write JSON only (no markdown fences) for a landing page about "${tool.name}" localized for ${place}.

Tool category: ${tool.category}
Tool summary: ${tool.tagline}

Requirements:
- "insights": array of exactly 3 short strings (2 sentences max each), actionable, plain English.
- "sections": array of 5 objects with "heading" and "paragraphs" (array of 2-3 strings each). Total reading length ~800-1100 words across all paragraphs. Cover: why the topic matters locally, how to use the tool, practical tips, California/West relevance once, when to hire an agent/lender.
- "faqs": array of 6-7 objects with "question" and "answer". Include local angle where natural.

Tone: helpful, simple, conversion-friendly. No medical/legal guarantees.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON objects matching the user schema. No markdown, no commentary.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("programmatic SEO OpenAI error", res.status, json);
      return null;
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as AiShape;
    return normalizePayload(parsed);
  } catch (e) {
    console.warn("generateProgrammaticSeoWithAi", e);
    return null;
  }
}
