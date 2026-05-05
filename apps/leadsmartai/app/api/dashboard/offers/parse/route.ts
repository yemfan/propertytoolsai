import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { generateAIResponse } from "@/lib/ai/aiService";
import {
  PARSED_OFFER_SCHEMA_INSTRUCTION,
  coerceParsedOffer,
  extractJsonFromAiResponse,
} from "@/lib/offers/parsedShape";

/**
 * POST /api/dashboard/offers/parse
 *
 * Body: { text: string }
 *
 * Takes raw offer text the agent pasted (typically copied from a PDF
 * the listing agent sent over) and asks the AI to extract structured
 * fields. Returns null for any field the document doesn't clearly
 * specify — agents must always review the output before saving, so
 * we'd rather show "—" than guess.
 *
 * Sibling route /api/dashboard/offers/parse-pdf accepts the PDF
 * directly when the agent has the file rather than the text. Both
 * return the same ParsedOffer shape (see lib/offers/parsedShape.ts).
 *
 * Cost note: an offer doc is typically 3-15k tokens of prose. We
 * truncate to MAX_INPUT_CHARS so a runaway paste doesn't blow up
 * a single request.
 */

const MAX_INPUT_CHARS = 60_000;

const PROMPT_HEADER = `You extract structured offer fields from a real-estate offer/contract pasted by an agent.

${PARSED_OFFER_SCHEMA_INSTRUCTION}

Document follows after "---".

---
`;

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const userId = ctx.userId || ctx.agentId;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Paste the offer text first." },
        { status: 400 },
      );
    }
    if (text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: `Document is too long (${text.length.toLocaleString()} chars > ${MAX_INPUT_CHARS.toLocaleString()} cap). Trim to the offer page + key contingencies.`,
        },
        { status: 413 },
      );
    }

    const prompt = `${PROMPT_HEADER}${text}`;

    let aiText = "";
    try {
      const resp = await generateAIResponse({
        prompt,
        userId: String(userId),
        tool: "offer_parse",
        // Low temperature — we want deterministic extraction, not creativity.
        temperature: 0.1,
        // Cache hits would mask edits the agent makes between attempts.
        useCache: false,
      });
      aiText = resp.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI call failed";
      return NextResponse.json(
        { ok: false, error: msg },
        { status: 502 },
      );
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(extractJsonFromAiResponse(aiText));
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We got a response from the AI but couldn't read it as JSON. Try again, or fall back to + New offer to enter manually.",
          rawAi: aiText.slice(0, 1000),
        },
        { status: 502 },
      );
    }

    const parsed = coerceParsedOffer(parsedRaw);
    return NextResponse.json({ ok: true, parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/offers/parse:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
