import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { RecommendationProperty } from "@/lib/propertyData";

type RankedRow = {
  property: RecommendationProperty;
  dealScore: number;
};

export async function explainRecommendations(
  subject: RecommendationProperty,
  ranked: RankedRow[]
): Promise<string> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) {
    return "These alternatives are ranked higher due to better value per square foot, competitive pricing, and close feature match to your original property.";
  }

  const payload = {
    subject,
    alternatives: ranked.map((r) => ({
      id: r.property.id,
      address: r.property.address,
      price: r.property.price,
      beds: r.property.beds,
      baths: r.property.baths,
      sqft: r.property.sqft,
      location: r.property.location,
      dealScore: r.dealScore,
    })),
  };

  const prompt =
    "Explain why these properties are better alternatives compared to the original property.\n" +
    "Keep it to 3-5 concise sentences, client-friendly.\n\n" +
    JSON.stringify(payload, null, 2);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 280,
      messages: [
        { role: "system", content: "You are a concise real-estate analyst." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json?.choices?.[0]?.message?.content?.trim() || "";
}
