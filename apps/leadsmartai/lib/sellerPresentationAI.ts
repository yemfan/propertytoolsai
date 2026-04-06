export type PropertyContext = {
  address: string;
  city: string | null;
  state: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
  low: number | null;
  high: number | null;
  avgPricePerSqft: number | null;
  comps: Array<{
    address: string;
    price: number;
    sqft: number;
    soldDate: string;
    distanceMiles: number;
  }>;
};

export type SellerPresentationPropertyAI = {
  highlight: string;
  summary: string;
  strengths: string[];
  considerations: string[];
};

export type SellerPresentationAI = {
  executive_summary: string;
  market_overview: string;
  recommendation: string;
  properties: Record<string, SellerPresentationPropertyAI>;
};

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error("AI output did not contain a JSON object.");
}

function buildFallback(properties: PropertyContext[]): SellerPresentationAI {
  const propEntries: Record<string, SellerPresentationPropertyAI> = {};
  for (const p of properties) {
    propEntries[p.address] = {
      highlight: `${p.beds ?? "?"}bd/${p.baths ?? "?"}ba home in ${p.city ?? "the area"}`,
      summary: p.estimatedValue
        ? `This property is estimated at $${Math.round(p.estimatedValue).toLocaleString()} based on ${p.comps.length} comparable sales in the area.`
        : "Estimated value is pending additional comparable data.",
      strengths: ["Competitive location", "Solid comparable sales support"],
      considerations: ["Market conditions may vary", "Further analysis recommended"],
    };
  }
  return {
    executive_summary: "This seller presentation compares selected properties using recent comparable sales data and market analysis.",
    market_overview: "The local market shows steady activity with recent comparable sales providing strong pricing support.",
    recommendation: "We recommend pricing competitively within the estimated range to attract qualified buyers quickly.",
    properties: propEntries,
  };
}

export async function generateSellerPresentationAI(
  properties: PropertyContext[]
): Promise<SellerPresentationAI> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = buildFallback(properties);
  if (!apiKey) return fallback;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const propertiesForPrompt = properties.map((p, i) => ({
    index: i + 1,
    address: p.address,
    city: p.city,
    state: p.state,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    type: p.propertyType,
    year_built: p.yearBuilt,
    estimated_value: p.estimatedValue,
    value_range_low: p.low,
    value_range_high: p.high,
    avg_price_per_sqft: p.avgPricePerSqft,
    top_comps: p.comps.slice(0, 3).map((c) => ({
      address: c.address,
      sold_price: c.price,
      sold_date: c.soldDate,
      sqft: c.sqft,
      distance_miles: c.distanceMiles,
    })),
  }));

  const prompt = `You are a senior real estate advisor preparing a professional seller presentation.

Analyze these ${properties.length} properties and generate compelling, narrative content for a seller presentation. Focus on what makes each property attractive — DO NOT dump raw numbers. Use specific data points only when they strengthen the narrative (e.g. "priced 12% below comparable sales" or "one of the largest lots in the neighborhood").

Return ONLY valid JSON with this schema:
{
  "executive_summary": string (2-3 sentences, high-level overview of all properties),
  "market_overview": string (2-3 sentences about the local market based on comp data),
  "recommendation": string (2-3 sentences, actionable advice for the seller),
  "properties": {
    "<address>": {
      "highlight": string (1 compelling sentence hook),
      "summary": string (3-4 sentence narrative about this property's value proposition),
      "strengths": [3-4 short bullet points],
      "considerations": [2-3 short bullet points]
    }
  }
}

Use the exact property addresses as keys in the "properties" object.

Properties:
${JSON.stringify(propertiesForPrompt, null, 2)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          { role: "system", content: "Return ONLY valid JSON. No markdown fences. No extra commentary." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      console.error("sellerPresentationAI: OpenAI request failed", await res.text().catch(() => ""));
      return fallback;
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = extractJsonObject(content) as Record<string, unknown>;

    return {
      executive_summary: String(parsed.executive_summary ?? fallback.executive_summary),
      market_overview: String(parsed.market_overview ?? fallback.market_overview),
      recommendation: String(parsed.recommendation ?? fallback.recommendation),
      properties: (() => {
        const propsObj = (parsed.properties ?? {}) as Record<string, Record<string, unknown>>;
        const result: Record<string, SellerPresentationPropertyAI> = {};
        for (const p of properties) {
          const ai = propsObj[p.address];
          const fb = fallback.properties[p.address];
          result[p.address] = {
            highlight: String(ai?.highlight ?? fb?.highlight ?? ""),
            summary: String(ai?.summary ?? fb?.summary ?? ""),
            strengths: Array.isArray(ai?.strengths) ? (ai.strengths as string[]).map(String) : fb?.strengths ?? [],
            considerations: Array.isArray(ai?.considerations) ? (ai.considerations as string[]).map(String) : fb?.considerations ?? [],
          };
        }
        return result;
      })(),
    };
  } catch (e) {
    console.error("sellerPresentationAI: generation failed", e);
    return fallback;
  }
}
