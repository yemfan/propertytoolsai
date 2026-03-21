import type { SerpPageType } from "./types";

const BASE = `You write for PropertyTools AI (real estate calculators + education). JSON only, no markdown fences.`;

export function buildPromptForPageType(keyword: string, pageType: SerpPageType, clusterHint?: string): string {
  const cluster = clusterHint ? `Cluster context: ${clusterHint}.` : "";
  const common = `Primary keyword phrase: "${keyword}". ${cluster}
Include the keyword naturally in title, first paragraph, and one heading.`;

  switch (pageType) {
    case "tool":
      return `${BASE}
Page type: TOOL — calculator / interactive framing (no real code), strong CTA to run numbers.
${common}
Return JSON:
{
  "title": string (<=60 chars),
  "meta_description": string (140-160 chars),
  "payload": {
    "pageType": "tool",
    "lede": string,
    "toolCta": { "headline": string, "bullets": string[] (4-5) },
    "sections": [ { "heading": string, "paragraphs": string[] (2 each) } ] (4 sections)
  },
  "snippet_blocks": [
    { "type": "definition", "term": string, "definition": string },
    { "type": "bullets", "items": string[] (4-5) }
  ]
}`;

    case "landing":
      return `${BASE}
Page type: LANDING — conversion-focused: hero, benefits, objections, CTA.
${common}
Return JSON:
{
  "title": string,
  "meta_description": string,
  "payload": {
    "pageType": "landing",
    "lede": string,
    "sections": [ { "heading": string, "paragraphs": string[] (2-3 each) } ] (5 sections: hero value, how it works, who it's for, trust, FAQ teaser)
  },
  "snippet_blocks": [
    { "type": "paragraph", "text": string (40-60 words, snippet-ready) },
    { "type": "bullets", "items": string[] (5) }
  ]
}`;

    case "blog":
      return `${BASE}
Page type: BLOG — long-form guide (1200-1800 words total in sections).
${common}
Return JSON:
{
  "title": string,
  "meta_description": string,
  "payload": {
    "pageType": "blog",
    "lede": string,
    "sections": [ { "heading": string, "paragraphs": string[] (3-4 each) } ] (6-7 sections)
  },
  "snippet_blocks": [
    { "type": "paragraph", "text": string (featured snippet style answer, 45-55 words) },
    { "type": "bullets", "items": string[] (step-by-step, 5-6) }
  ]
}`;

    case "comparison":
      return `${BASE}
Page type: COMPARISON — compare options (e.g. loan types, rent vs buy angles) with a small comparison table + prose.
${common}
Return JSON:
{
  "title": string,
  "meta_description": string,
  "payload": {
    "pageType": "comparison",
    "lede": string,
    "comparisonRows": [ { "label": string, "a": string, "b": string } ] (6-8 rows),
    "sections": [ { "heading": string, "paragraphs": string[] (2 each) } ] (3 sections wrapping the comparison)
  },
  "snippet_blocks": [
    { "type": "definition", "term": string, "definition": string },
    { "type": "bullets", "items": string[] (pros/cons style, 6) }
  ]
}`;

    case "faq":
      return `${BASE}
Page type: FAQ — 10-12 Q&As optimized for FAQ schema and People Also Ask.
${common}
Return JSON:
{
  "title": string,
  "meta_description": string,
  "payload": {
    "pageType": "faq",
    "lede": string,
    "faqs": [ { "question": string, "answer": string } ] (10-12),
    "sections": [ { "heading": string, "paragraphs": string[] (1-2 each) } ] (2 short sections intro/outro)
  },
  "snippet_blocks": [
    { "type": "paragraph", "text": string (direct answer to main query) },
    { "type": "bullets", "items": string[] (quick facts, 5) }
  ]
}`;

    default:
      return "";
  }
}
