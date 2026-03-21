type AutomationParams = {
  template: string;
  name: string;
  address: string;
  rating: "hot" | "warm" | "cold";
  engagementScore: number;
  recentEvents: string[];
};

function renderTemplate(t: string, vars: Record<string, string>) {
  let out = t;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export async function generateAutomationMessage(params: AutomationParams) {
  const base = renderTemplate(params.template, {
    name: params.name || "there",
    address: params.address || "your property",
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return base;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = `Rewrite the message below as a short, friendly real estate follow-up.\n\nContext:\n- Lead rating: ${params.rating}\n- Engagement score: ${params.engagementScore}\n- Recent activity: ${params.recentEvents.join(", ") || "none"}\n- Property: ${params.address}\n\nRules:\n- Keep it under 80 words.\n- End with exactly one question.\n- Do not be spammy.\n- Sign off as “— LeadSmart AI”.\n\nMessage to rewrite:\n${base}\n`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: "You write concise, human follow-ups." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) return base;
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : base;
}

