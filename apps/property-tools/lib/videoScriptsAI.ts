type VideoScriptParams = {
  city?: string;
  audience?: "seller" | "buyer" | "investor" | "general";
  topic?: string;
};

export async function generateVideoScripts(params: VideoScriptParams) {
  const city = params.city?.trim() || "your market";
  const audience = params.audience || "seller";
  const topic = params.topic?.trim() || "home value update";

  const fallback = [
    {
      hook: `Thinking about ${topic} in ${city}?`,
      talkingPoints: [
        `Quick local stat for ${city} homeowners.`,
        `Biggest mistake ${audience}s make when waiting too long.`,
        "What to do in the next 7 days to be ready.",
      ],
      cta: "Comment 'REPORT' and I will send your personalized estimate.",
    },
    {
      hook: `Most ${audience}s in ${city} miss this market signal.`,
      talkingPoints: [
        "What changed in the last 30 days.",
        "How it impacts your timeline and price.",
        "One action you can take today.",
      ],
      cta: "Send me your address and I will run a free local analysis.",
    },
  ];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = `Create 3 short-form real estate video scripts for ${audience}s in ${city} about "${topic}".\nReturn strict JSON array. Each item fields:\n- hook (1 sentence)\n- talkingPoints (array of 3 short bullets)\n- cta (1 sentence)\nRules: concise, conversational, high-conversion CTA.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are a high-converting real estate content strategist." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return fallback;
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content) return fallback;

  try {
    const parsed = JSON.parse(content);
    const scripts = Array.isArray(parsed) ? parsed : parsed?.scripts;
    if (!Array.isArray(scripts) || !scripts.length) return fallback;
    return scripts.slice(0, 5).map((s: any) => ({
      hook: String(s.hook ?? "").trim(),
      talkingPoints: Array.isArray(s.talkingPoints)
        ? s.talkingPoints.slice(0, 5).map((p: any) => String(p))
        : [],
      cta: String(s.cta ?? "").trim(),
    }));
  } catch {
    return fallback;
  }
}

