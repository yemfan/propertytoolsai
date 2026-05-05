import "server-only";
import { getAnthropicClient } from "@/lib/anthropic";
import {
  PARSED_OFFER_SCHEMA_INSTRUCTION,
  coerceParsedOffer,
  extractJsonFromAiResponse,
  type ParsedOffer,
} from "./parsedShape";

/**
 * Extract structured offer fields directly from a PDF using Claude's
 * native document support. Mirror of `lib/transactions/extractContract`
 * but with the offer schema (price, contingencies, dates, agent
 * contact) instead of the buyer-rep RPA shape.
 *
 * Why Claude (not GPT) for the PDF path:
 *   - The text-paste flow uses GPT through generateAIResponse so we
 *     stay in the existing OpenAI cost lane.
 *   - Claude's PDF support is meaningfully better at structured
 *     extraction from real-world purchase agreements (CAR RPA
 *     forms, multi-page boilerplate, scanned headers). Same model
 *     and call shape we already use for the transactions
 *     extract-contract route, so this doesn't add a new dependency.
 */
const SYSTEM_PROMPT = `You are an extraction system for residential real estate purchase offers.

The user will provide an offer or purchase agreement PDF (often a California CAR RPA, but could be any state's standard contract). Extract the deal facts as a JSON object — no commentary, no markdown fences.

${PARSED_OFFER_SCHEMA_INSTRUCTION}`;

const USER_INSTRUCTION =
  "Extract the offer facts from this PDF. Return only the JSON object — no commentary, no markdown fences.";

export async function extractOfferFromPdf(
  pdfBytes: Uint8Array,
): Promise<ParsedOffer> {
  const client = getAnthropicClient();
  const base64 = Buffer.from(pdfBytes).toString("base64");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          { type: "text", text: USER_INSTRUCTION },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Offer extractor returned no text content");
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(extractJsonFromAiResponse(textBlock.text));
  } catch {
    throw new Error(
      `Offer extractor did not return valid JSON: ${textBlock.text.slice(0, 200)}`,
    );
  }

  return coerceParsedOffer(parsedRaw);
}
