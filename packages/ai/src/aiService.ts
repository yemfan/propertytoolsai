import { openaiClient } from "./openaiClient";
import { hashPrompt, getCachedResponse, setCachedResponse } from "./cache";
import { estimateTokens, logAiUsage } from "./usage";

export type GenerateAIResponseInput = {
  prompt: string;
  userId: string;
  tool: string;
  temperature?: number;
  useCache?: boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Central AI call: cache → OpenAI → persist cache → log usage.
 * Temperature default 0.7. Returns plain text only.
 */
export async function generateAIResponse(input: GenerateAIResponseInput): Promise<{
  text: string;
  cached: boolean;
  tokensUsed: number;
}> {
  const { prompt, userId, tool } = input;
  const temperature = input.temperature ?? 0.7;
  const useCache = input.useCache !== false;

  const promptHash = hashPrompt(`${tool}::${prompt}`);
  if (useCache) {
    const hit = await getCachedResponse(promptHash);
    if (hit) {
      await logAiUsage({
        userId,
        tool: `${tool}_cache_hit`,
        tokensUsed: 0,
      });
      return { text: hit, cached: true, tokensUsed: 0 };
    }
  }

  const { apiKey, model } = openaiClient.getConfig();
  if (!apiKey) {
    throw new Error("AI is not configured (missing OPENAI_API_KEY).");
  }

  let lastErr: Error | null = null;
  let text = "";
  let tokensUsed = estimateTokens(prompt);

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`OpenAI HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const json = (await res.json()) as any;
      const choice = json?.choices?.[0]?.message?.content;
      if (typeof choice !== "string" || !choice.trim()) {
        throw new Error("Empty AI response");
      }

      text = choice.trim();
      const apiTokens = json?.usage?.total_tokens;
      tokensUsed =
        typeof apiTokens === "number" && Number.isFinite(apiTokens)
          ? apiTokens
          : estimateTokens(prompt) + estimateTokens(text);
      break;
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < 2) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  if (!text && lastErr) {
    console.error("[LeadSmart AI] generateAIResponse failed", lastErr.message);
    throw new Error("We couldn’t generate a response right now. Please try again shortly.");
  }

  if (useCache && text) {
    await setCachedResponse(promptHash, text);
  }

  await logAiUsage({ userId, tool, tokensUsed });

  return { text, cached: false, tokensUsed };
}

