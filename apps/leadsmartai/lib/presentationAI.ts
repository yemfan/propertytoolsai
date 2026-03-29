export type PresentationAISections = {
  pricing_strategy: string;
  market_insights: string;
  marketing_plan: string;
};

function extractJsonObject(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(slice);
  }

  throw new Error("AI output did not contain a JSON object.");
}

export async function generatePresentationAISections(params: {
  address: string;
  estimate: {
    estimatedValue: number | null;
    low: number | null;
    high: number | null;
    avgPricePerSqft: number | null;
    summary: string;
  };
  comps: Array<{
    address: string;
    price: number | null;
    sqft: number | null;
    soldDate: string;
    distanceMiles: number | null;
  }>;
}): Promise<PresentationAISections> {
  const apiKey = process.env.OPENAI_API_KEY;

  const fallback: PresentationAISections = {
    pricing_strategy:
      "Suggested approach: price competitively within the estimated range and use recent comp momentum to support your final list price. Consider offering strong initial terms (e.g., quick-close incentives) to attract qualified showings.",
    market_insights:
      params.estimate.summary ||
      "Based on nearby comparable sold properties, your home’s estimated value is supported by current market conditions and pricing patterns in the area.",
    marketing_plan:
      "Marketing plan: optimize listing photos for the buyer journey, write a compelling headline focused on buyer benefits, schedule targeted social + local search ads, and use a weekly open house + follow-up cadence to build momentum.",
  };

  if (!apiKey) return fallback;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Avoid raw MLS/warehouse details; include only what’s needed for strategy.
  const compsForPrompt = params.comps
    .slice(0, 8)
    .map((c, idx) => ({
      rank: idx + 1,
      address: c.address,
      sold_price: c.price,
      sold_date: c.soldDate,
      sqft: c.sqft,
      distance_miles: c.distanceMiles,
    }));

  const prompt = `You are a professional real estate listing strategist.

Create three sections for a homeowner presentation based on the property address, the point estimate/range, and a short list of nearby sold comps.

Return ONLY valid JSON with this exact schema:
{
  "pricing_strategy": string,
  "market_insights": string,
  "marketing_plan": string
}

Rules:
- Do not include any raw MLS identifiers.
- Keep content specific to the neighborhood pattern implied by the comps.
- Use concise but persuasive language suitable for a seller.
- Marketing plan should include timing + channels + next steps.

Address: ${params.address}

Estimate:
- estimatedValue: ${params.estimate.estimatedValue}
- low: ${params.estimate.low}
- high: ${params.estimate.high}
- summary: ${params.estimate.summary}

Nearby sold comps (JSON):
${JSON.stringify(compsForPrompt, null, 2)}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: "Return ONLY JSON. No extra keys. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.error("OpenAI request failed", await res.text().catch(() => ""));
    return fallback;
  }

  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return fallback;

  try {
    const parsed = extractJsonObject(content);
    return {
      pricing_strategy: String(parsed?.pricing_strategy ?? fallback.pricing_strategy),
      market_insights: String(parsed?.market_insights ?? fallback.market_insights),
      marketing_plan: String(parsed?.marketing_plan ?? fallback.marketing_plan),
    };
  } catch (e) {
    console.error("OpenAI JSON parse failed", e);
    return fallback;
  }
}

