import type { ProgrammaticSeoPayload } from "@/lib/programmaticSeo/types";

function isPayloadShape(x: unknown): x is ProgrammaticSeoPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.insights) &&
    Array.isArray(o.sections) &&
    Array.isArray(o.faqs) &&
    (o.source === "ai" || o.source === "fallback")
  );
}

/**
 * Normalizes DB `payload_json` into a full `ProgrammaticSeoPayload` or returns null.
 */
export function parseOverridePayload(raw: unknown): ProgrammaticSeoPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const insights = Array.isArray(o.insights) ? o.insights.map((x) => String(x).trim()).filter(Boolean) : [];
  const faqsRaw = Array.isArray(o.faqs) ? o.faqs : [];
  const faqs = faqsRaw
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const q = String((f as Record<string, unknown>).question ?? "").trim();
      const a = String((f as Record<string, unknown>).answer ?? "").trim();
      return q && a ? { question: q, answer: a } : null;
    })
    .filter(Boolean) as { question: string; answer: string }[];

  const secRaw = Array.isArray(o.sections) ? o.sections : [];
  const sections = secRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const heading = String((s as Record<string, unknown>).heading ?? "").trim();
      const paras = (s as Record<string, unknown>).paragraphs;
      const paragraphs = Array.isArray(paras)
        ? paras.map((p) => String(p).trim()).filter(Boolean)
        : [];
      return heading && paragraphs.length ? { heading, paragraphs } : null;
    })
    .filter(Boolean) as { heading: string; paragraphs: string[] }[];

  const source = o.source === "ai" || o.source === "fallback" ? o.source : "ai";
  if (insights.length < 2 || sections.length < 3 || faqs.length < 5) return null;
  return { insights, sections, faqs, source };
}

/**
 * Prefer full override payload when valid; otherwise keep base.
 */
export function mergeProgrammaticPayload(
  base: ProgrammaticSeoPayload,
  payloadJson: unknown
): ProgrammaticSeoPayload {
  const parsed = parseOverridePayload(payloadJson);
  if (parsed) return parsed;
  if (isPayloadShape(payloadJson)) return payloadJson;
  return base;
}
