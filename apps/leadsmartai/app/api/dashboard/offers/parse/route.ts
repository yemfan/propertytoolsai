import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { generateAIResponse } from "@/lib/ai/aiService";

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
 * No persistence here. The client takes the response, prefills the
 * /dashboard/offers/new form, and the agent reviews + submits.
 *
 * Cost note: an offer doc is typically 3-15k tokens of prose. We
 * truncate to MAX_INPUT_CHARS so a runaway paste doesn't blow up
 * a single request.
 */

const MAX_INPUT_CHARS = 60_000;

const PARSE_PROMPT_HEADER = `You extract structured offer fields from a real-estate offer/contract pasted by an agent.

Return ONLY valid JSON matching this exact shape (no prose, no markdown fences):
{
  "propertyAddress": string | null,
  "city": string | null,
  "state": string | null,
  "zip": string | null,
  "listPrice": number | null,
  "offerPrice": number | null,
  "earnestMoney": number | null,
  "downPayment": number | null,
  "financingType": "cash" | "conventional" | "fha" | "va" | "jumbo" | "other" | null,
  "closingDateProposed": string | null,
  "offerExpiresAt": string | null,
  "inspectionContingency": boolean | null,
  "appraisalContingency": boolean | null,
  "loanContingency": boolean | null,
  "contingencyNotes": string | null,
  "notes": string | null
}

Rules:
- Use null for any field the document doesn't clearly state. Don't guess.
- Numeric fields are integers (no $, commas, decimals).
- Dates are ISO 8601 strings: "YYYY-MM-DD" for closingDateProposed, full "YYYY-MM-DDTHH:MM:SSZ" for offerExpiresAt.
- inspectionContingency / appraisalContingency / loanContingency: true if the contract WAIVES the contingency, false if it RETAINS it. Otherwise null. (When in doubt, null — agent will set this themselves.)
- contingencyNotes: any contingency clauses NOT covered by the three booleans (sale-of-home, short-sale approval, etc.). Plain prose, max ~200 chars.
- notes: brief 1-2 sentence summary of anything notable (escalation clause, all-cash, expedited close, seller credits, etc.). Max ~300 chars. Empty string OK; null means nothing notable.
- state: 2-letter US abbreviation (e.g. "CA").
- financingType: pick the closest match. "loan" or "mortgage" → "conventional". "cash offer" → "cash".

Document follows after "---".

---
`;

type ParsedOffer = {
  propertyAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  offerPrice: number | null;
  earnestMoney: number | null;
  downPayment: number | null;
  financingType:
    | "cash"
    | "conventional"
    | "fha"
    | "va"
    | "jumbo"
    | "other"
    | null;
  closingDateProposed: string | null;
  offerExpiresAt: string | null;
  inspectionContingency: boolean | null;
  appraisalContingency: boolean | null;
  loanContingency: boolean | null;
  contingencyNotes: string | null;
  notes: string | null;
};

/** Strip ```json fences and stray text around the AI's JSON. */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  // Common case: AI wrapped in ```json ... ``` despite instructions.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Otherwise grab the outermost {...}.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function asNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStrOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function asBoolOrNull(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function normalizeFinancing(
  v: unknown,
): ParsedOffer["financingType"] {
  const s = asStrOrNull(v)?.toLowerCase();
  if (!s) return null;
  if (["cash", "conventional", "fha", "va", "jumbo", "other"].includes(s)) {
    return s as ParsedOffer["financingType"];
  }
  if (s.includes("conv")) return "conventional";
  if (s.includes("fha")) return "fha";
  if (s.includes("va")) return "va";
  if (s.includes("jumbo")) return "jumbo";
  if (s.includes("cash")) return "cash";
  return "other";
}

function coerceParsedOffer(raw: unknown): ParsedOffer {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    propertyAddress: asStrOrNull(obj.propertyAddress),
    city: asStrOrNull(obj.city),
    state: asStrOrNull(obj.state)?.slice(0, 2)?.toUpperCase() ?? null,
    zip: asStrOrNull(obj.zip),
    listPrice: asNumOrNull(obj.listPrice),
    offerPrice: asNumOrNull(obj.offerPrice),
    earnestMoney: asNumOrNull(obj.earnestMoney),
    downPayment: asNumOrNull(obj.downPayment),
    financingType: normalizeFinancing(obj.financingType),
    closingDateProposed: asStrOrNull(obj.closingDateProposed),
    offerExpiresAt: asStrOrNull(obj.offerExpiresAt),
    inspectionContingency: asBoolOrNull(obj.inspectionContingency),
    appraisalContingency: asBoolOrNull(obj.appraisalContingency),
    loanContingency: asBoolOrNull(obj.loanContingency),
    contingencyNotes: asStrOrNull(obj.contingencyNotes),
    notes: asStrOrNull(obj.notes),
  };
}

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

    const prompt = `${PARSE_PROMPT_HEADER}${text}`;

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
      parsedRaw = JSON.parse(extractJson(aiText));
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
