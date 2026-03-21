import type { FunnelStep, KpiSummary } from "./types";

export async function generateRevenueInsights(params: {
  kpis: KpiSummary;
  funnel: FunnelStep[];
  alertMessages: string[];
}): Promise<{ text: string; model: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return {
      text:
        "Set OPENAI_API_KEY in your environment to generate AI insights. Meanwhile, use KPI cards and the funnel to spot drop-offs and revenue trends.",
      model: null,
    };
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL ?? "gpt-4o-mini";

  const payload = {
    kpis: params.kpis,
    funnel: params.funnel,
    recent_alerts: params.alertMessages.slice(0, 8),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a senior data and product analyst. Give concise, actionable revenue and funnel insights for a B2B SaaS / proptech operator. Use bullet points. No fluff. If data is sparse, say what to track next.",
        },
        {
          role: "user",
          content: `Analyze this dashboard snapshot (JSON):\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return {
      text: `Insights unavailable (${res.status}). ${err.slice(0, 200)}`,
      model: null,
    };
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "No content.";
  return { text, model };
}
