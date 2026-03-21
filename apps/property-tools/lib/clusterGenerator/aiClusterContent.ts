import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { ClusterPagePayload, ClusterTopicDefinition } from "./types";

type AiOut = {
  title: string;
  meta_description: string;
  insights: string[];
  sections: { heading: string; paragraphs: string[] }[];
  faqs: { question: string; answer: string }[];
};

function normalizePayload(raw: unknown): { meta: { title: string; description: string }; payload: ClusterPagePayload } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? "").trim();
  const meta_description = String(o.meta_description ?? "").trim();
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

  if (!title || !meta_description || insights.length < 3 || sections.length < 4 || faqs.length < 5) return null;
  return {
    meta: { title, description: meta_description },
    payload: { insights, sections, faqs, source: "ai" },
  };
}

export async function generateClusterContentWithAi(input: {
  topic: ClusterTopicDefinition;
  city: string;
  state: string;
  place: string;
  primaryKeyword: string;
}): Promise<{ meta: { title: string; description: string }; payload: ClusterPagePayload } | null> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return null;

  const { topic, place, primaryKeyword } = input;

  const prompt = `You are an SEO editor for PropertyTools AI (real estate education + calculators).

Write JSON only (no markdown) for a pillar guide page.

Topic cluster: "${topic.name}" (slug: ${topic.slug})
Primary keyword phrase: "${primaryKeyword}"
Secondary keywords: ${topic.keywords.join(", ")}
Localized for: ${place}

Requirements:
- "title": <= 60 chars if possible, include city/state naturally, compelling.
- "meta_description": 140-160 characters, benefit-led, includes keyword intent.
- "insights": exactly 3 short strings (2 sentences max each).
- "sections": 5 objects with "heading" and "paragraphs" (2-3 paragraphs each). Total ~900-1200 words. Mention ${place} naturally 4-6 times, not stuffed.
- "faqs": 6 objects with "question" and "answer" (local angle where natural).

Tone: helpful, trustworthy, plain English. No guarantees or legal advice.`;

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
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You output only valid JSON. No markdown fences, no commentary.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("cluster generator OpenAI error", res.status, json);
      return null;
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as AiOut;
    return normalizePayload(parsed);
  } catch (e) {
    console.warn("generateClusterContentWithAi", e);
    return null;
  }
}
