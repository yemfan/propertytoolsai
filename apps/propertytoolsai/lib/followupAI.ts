type FollowUpParams = {
  rating: "hot" | "warm" | "cold";
  name: string;
  address: string;
  intent: "buying" | "selling" | "unknown";
};

export async function generateFollowUpMessage(params: FollowUpParams) {
  const apiKey = process.env.OPENAI_API_KEY;

  const fallback = (tone: string) =>
    `Hi ${params.name || "there"},\n\nJust checking in${params.address ? ` about ${params.address}` : ""}. ${tone}\n\nIf you’d like, I can share a quick update on pricing in your area and next steps.\n\n— PropertyTools AI`;

  if (!apiKey) {
    if (params.rating === "hot")
      return fallback("Happy to help whenever you're ready—would you like a quick call today or tomorrow?");
    if (params.rating === "cold")
      return fallback("No rush at all—should I check back next month or would you prefer not to receive follow-ups?");
    return fallback("Any questions I can answer for you this week?");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = `Write a friendly real estate follow-up message.\n\nLead rating: ${params.rating}\nIntent: ${params.intent}\nLead name: ${params.name}\nProperty address: ${params.address}\n\nConstraints:\n- Keep it under 80 words.\n- 1 short question at the end.\n- Do not sound spammy.\n- Sign off as “— PropertyTools AI”.\n`;

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

  if (!res.ok) {
    console.error("OpenAI follow-up request failed", await res.text().catch(() => ""));
    return fallback("Any questions I can answer for you this week?");
  }

  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return fallback("Any questions I can answer for you this week?");
  }
  return content.trim();
}

