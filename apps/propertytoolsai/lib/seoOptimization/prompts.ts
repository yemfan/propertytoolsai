import type { OptimizationAction } from "./types";

export function buildOptimizationSystemPrompt(): string {
  return [
    "You are an SEO + conversion copy editor for PropertyTools AI (real estate calculators).",
    "Output only valid JSON (no markdown fences). Follow the user's schema exactly.",
    "Tone: helpful, plain English, trustworthy. No legal/medical guarantees.",
    "Include local relevance for the given city and state when it fits naturally.",
  ].join(" ");
}

export function buildOptimizationUserPrompt(input: {
  action: OptimizationAction;
  toolName: string;
  toolCategory: string;
  toolTagline: string;
  city: string;
  state: string;
  place: string;
  metrics: { impressions: number; ctr: number; positionAvg: number | null };
  defaultTitle: string;
  defaultDescription: string;
  currentPayload: {
    insights: string[];
    sections: { heading: string; paragraphs: string[] }[];
    faqs: { question: string; answer: string }[];
  };
  relatedToolNames: string[];
}): string {
  const actionHint =
    input.action === "rewrite_full"
      ? "Rewrite the entire page body for stronger relevance and depth. Keep structure similar (insights, sections, FAQs) but improve E-E-A-T and keyword coverage."
      : input.action === "improve_content"
        ? "Improve section headings and paragraphs for mid-funnel intent; keep FAQs but refine answers where weak."
        : input.action === "improve_title_meta"
          ? "Focus on title + meta: higher CTR, clear benefit, include place. Light-touch body edits only if needed for consistency."
          : input.action === "add_faqs"
            ? "Expand FAQs: add 2-3 new high-intent Q&As; tighten existing answers. Minor body polish OK."
            : "Maintain quality; small consistency edits only.";

  const internal =
    input.relatedToolNames.length > 0
      ? `Related tools to mention naturally in one section (with intent to link): ${input.relatedToolNames.join(", ")}.`
      : "";

  return [
    `Action: ${input.action}. ${actionHint}`,
    `Tool: ${input.toolName} (${input.toolCategory}). ${input.toolTagline}`,
    `Location: ${input.place}`,
    `Search metrics (approx): impressions=${input.metrics.impressions}, ctr=${(input.metrics.ctr * 100).toFixed(2)}%, avg position=${input.metrics.positionAvg ?? "n/a"}.`,
    `Default title (improve if generating new): ${input.defaultTitle}`,
    `Default meta description: ${input.defaultDescription}`,
    internal,
    "Return JSON with keys:",
    `- "title": string, <= 60 chars preferred, compelling, includes city/state if natural.`,
    `- "meta_description": string, 140-160 chars, benefit-led.`,
    `- "insights": string[], exactly 3 items.`,
    `- "sections": array of 5 objects { "heading", "paragraphs": string[] } with 2-3 paragraphs each.`,
    `- "faqs": array of 6-7 objects { "question", "answer" }.`,
    `- "internal_link_suggestions": string[] (optional), slugs or paths like /cap-rate-calculator to weave into copy.`,
    "Current JSON payload to optimize:",
    JSON.stringify(input.currentPayload),
  ].join("\n\n");
}
