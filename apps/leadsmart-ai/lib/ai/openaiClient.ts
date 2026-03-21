/**
 * OpenAI configuration singleton for LeadSmart AI.
 * API key is never exposed to clients — use only on the server.
 */

const MODEL_DEFAULT = "gpt-4o-mini";

let warnedMissingKey = false;

export type OpenAIClientConfig = {
  apiKey: string;
  model: string;
};

export function getOpenAIConfig(): OpenAIClientConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model = process.env.OPENAI_MODEL?.trim() || MODEL_DEFAULT;

  if (!apiKey && !warnedMissingKey && process.env.NODE_ENV !== "test") {
    warnedMissingKey = true;
    console.warn("[LeadSmart AI] OPENAI_API_KEY is not set.");
  }

  return { apiKey, model };
}

/** Singleton-style accessor (same config process-wide). */
export const openaiClient = {
  getConfig: getOpenAIConfig,
};
