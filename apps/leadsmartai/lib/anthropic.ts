import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client factory. Singleton at module scope so we don't
 * rebuild the HTTP pool on every request.
 *
 * Throws a descriptive error if ANTHROPIC_API_KEY isn't set — callers
 * should catch and return a user-friendly error, because the alternative
 * is a confusing SDK-level 401.
 */
let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. AI extraction requires it to be set in the runtime environment.",
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
