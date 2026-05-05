import type { FinancingType } from "./types";

/**
 * Structured offer fields the upload flows extract — shared by:
 *   - /api/dashboard/offers/parse        (text paste, GPT)
 *   - /api/dashboard/offers/parse-pdf    (PDF upload, Claude)
 *   - app/dashboard/offers/upload/UploadOfferClient.tsx
 *
 * The two parse endpoints both produce this shape so the client only
 * has to render one review screen regardless of input format.
 *
 * Convention for the three contingency booleans: `true` = the contract
 * WAIVES the contingency, `false` = it KEEPS it, `null` = the document
 * doesn't say. This is the OPPOSITE of the form's standard
 * `inspectionContingency` semantic (true = buyer wants the contingency
 * IN the offer); the upload client inverts before POSTing to the
 * existing offers API.
 */
export type ParsedOffer = {
  propertyAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  offerPrice: number | null;
  earnestMoney: number | null;
  downPayment: number | null;
  financingType: FinancingType | null;
  closingDateProposed: string | null;
  offerExpiresAt: string | null;
  inspectionContingency: boolean | null;
  appraisalContingency: boolean | null;
  loanContingency: boolean | null;
  contingencyNotes: string | null;
  notes: string | null;
};

/**
 * Schema description embedded in both the GPT and Claude prompts.
 * Updating this single source of truth keeps the two extractors in
 * sync — adding a new field anywhere in the offer flow only needs
 * one edit here, plus a coercion entry in `coerceParsedOffer`.
 */
export const PARSED_OFFER_SCHEMA_INSTRUCTION = `Return ONLY valid JSON matching this exact shape (no prose, no markdown fences):
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
- financingType: pick the closest match. "loan" or "mortgage" → "conventional". "cash offer" → "cash".`;

/** Strip ```json fences and stray text around the AI's JSON. */
export function extractJsonFromAiResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();
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

function normalizeFinancing(v: unknown): FinancingType | null {
  const s = asStrOrNull(v)?.toLowerCase();
  if (!s) return null;
  if (["cash", "conventional", "fha", "va", "jumbo", "other"].includes(s)) {
    return s as FinancingType;
  }
  if (s.includes("conv")) return "conventional";
  if (s.includes("fha")) return "fha";
  if (s.includes("va")) return "va";
  if (s.includes("jumbo")) return "jumbo";
  if (s.includes("cash")) return "cash";
  return "other";
}

/**
 * Coerce a raw AI response into a typed `ParsedOffer`. Field-level
 * fallbacks (state forced to 2-letter uppercase, financingType
 * normalized to the union, etc.) so the client never has to deal
 * with malformed responses.
 */
export function coerceParsedOffer(raw: unknown): ParsedOffer {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
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
