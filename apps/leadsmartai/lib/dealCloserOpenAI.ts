import { getOpenAIConfig } from "@/lib/ai/openaiClient";

/**
 * Server-only OpenAI helper for Deal Closer flows.
 */
export async function dealCloserChat(params: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return "";

  const body: Record<string, unknown> = {
    model,
    temperature: params.temperature ?? 0.45,
    max_tokens: params.maxTokens ?? 900,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  };

  if (params.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    console.error("dealCloserChat OpenAI error", res.status, json);
    return "";
  }

  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}
