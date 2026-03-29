import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { ClientPortalLead } from "@/lib/clientPortalContext";

export async function answerClientAssistantQuestion(params: {
  question: string;
  lead: ClientPortalLead | null;
}): Promise<string> {
  const { apiKey, model } = getOpenAIConfig();
  const q = params.question.trim();
  if (!q) return "Ask a question about your deal, timeline, or next steps.";

  const leadBlob = params.lead
    ? `Lead context (CRM): ${JSON.stringify({
        status: params.lead.lead_status,
        property: params.lead.property_address,
        search: params.lead.search_location,
        price_min: params.lead.price_min,
        price_max: params.lead.price_max,
        ai_intent: params.lead.ai_intent,
        ai_timeline: params.lead.ai_timeline,
      })}`
    : "No linked CRM lead yet — give general buyer/seller guidance.";

  if (!apiKey) {
    return [
      "AI answers need OPENAI_API_KEY on the server. Meanwhile: your agent can explain offer timelines, inspections, appraisal, and closing.",
      params.lead
        ? "Tip: check your dashboard for deal status and recommended next steps."
        : "Link your account email to a lead record so tips are personalized.",
    ].join(" ");
  }

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
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are LeadSmart AI helping homebuyers and sellers understand the process. Be concise, friendly, and accurate. Never provide legal, tax, or investment advice — encourage consulting their agent and professionals. Max ~120 words.",
          },
          {
            role: "user",
            content: `${leadBlob}\n\nClient question:\n${q}`,
          },
        ],
      }),
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    if (!res.ok) {
      console.error("clientPortalAi", res.status, json);
      return "I could not reach the AI service. Please try again or message your agent.";
    }
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return text || "No response — try rephrasing your question.";
  } catch (e) {
    console.error("clientPortalAi", e);
    return "Something went wrong. Please try again.";
  }
}
