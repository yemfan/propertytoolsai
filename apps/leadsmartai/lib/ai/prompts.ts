/**
 * Structured prompt templates for LeadSmart AI.
 * All user-controlled strings are sanitized before interpolation.
 */

export type LeadPromptInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  propertyAddress?: string | null;
  estimatedValue?: number | null;
  activitySummary?: string | null;
  score?: number | null;
  intent?: string | null;
  timeline?: string | null;
};

export type PropertyReportInput = {
  address?: string | null;
  city?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  estimatedValue?: number | null;
  marketNotes?: string | null;
};

export type CmaPromptInput = {
  subjectAddress?: string | null;
  estimatedValue?: number | null;
  low?: number | null;
  high?: number | null;
  compCount?: number | null;
  avgPricePerSqft?: number | null;
  summary?: string | null;
};

const MAX_FIELD = 800;
const MAX_SMS_CONTEXT = 400;

/** Strip control chars, collapse whitespace, cap length — reduces prompt injection surface. */
export function sanitizeForPrompt(input: string, maxLen = MAX_FIELD): string {
  const s = String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Neutralize common instruction override attempts (heuristic, not bulletproof).
  const blocked =
    /\b(ignore (all|previous) instructions|disregard|system prompt|you are now|jailbreak)\b/gi;
  const cleaned = s.replace(blocked, "[removed]");
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function baseAgentPersona(city?: string, language?: string): string {
  const loc = sanitizeForPrompt(city || "Los Angeles", 80);
  const lang = sanitizeForPrompt(language || "English", 40);
  return `You are a top real estate professional in ${loc}, specializing in helping buyers and sellers make smart, data-informed decisions.
Write in ${lang}. Be accurate, ethical, and compliant with fair housing — never discriminate.
Tone: warm, confident, concise, conversion-aware without being pushy or spammy.`;
}

export function smsFollowUp(
  lead: LeadPromptInput,
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const name = sanitizeForPrompt(lead.name || "there", 60);
  const addr = sanitizeForPrompt(lead.propertyAddress || "", 120);
  const city = sanitizeForPrompt(lead.city || "", 60);
  const activity = sanitizeForPrompt(lead.activitySummary || "recent interest in local market tools", MAX_SMS_CONTEXT);
  const value =
    lead.estimatedValue != null && Number.isFinite(lead.estimatedValue)
      ? `$${Math.round(lead.estimatedValue).toLocaleString()}`
      : "not specified";

  return `${persona}

TASK: Write ONE SMS (max 300 characters) to follow up with this lead.
CONTEXT (factual only):
- Name (or greeting target): ${name}
- Property / area: ${addr || city || "local area"}
- Estimated value context (if provided): ${value}
- Observed activity: ${activity}

REQUIREMENTS:
- Single short text message, no subject line
- Natural, conversational, not salesy
- End with ONE soft question
- Do not include markdown, bullets, or emojis unless subtle
- Do not claim guaranteed sale price or legal/tax advice
- Output ONLY the SMS body text, nothing else`;
}

export function emailFollowUp(
  lead: LeadPromptInput,
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const name = sanitizeForPrompt(lead.name || "there", 80);
  const addr = sanitizeForPrompt(lead.propertyAddress || "", 200);
  const city = sanitizeForPrompt(lead.city || "", 80);
  const activity = sanitizeForPrompt(lead.activitySummary || "engaged with your tools or content", 400);
  const value =
    lead.estimatedValue != null && Number.isFinite(lead.estimatedValue)
      ? `$${Math.round(lead.estimatedValue).toLocaleString()}`
      : "not specified";

  return `${persona}

TASK: Write a follow-up email body (plain text or light structure with short paragraphs).
CONTEXT:
- Recipient name: ${name}
- Property / area: ${addr || city || "local market"}
- Value context: ${value}
- Activity: ${activity}

REQUIREMENTS:
- Subject line on first line as: Subject: <concise subject>
- Then blank line, then email body (150–350 words)
- Include clear CTA (reply, book a call, or get a report) — one primary CTA
- Trust-building, specific to context, not generic spam
- Output ONLY the email (subject + body), no preamble`;
}

export function sellerReport(
  property: PropertyReportInput,
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const address = sanitizeForPrompt(property.address || "Subject property", 200);
  const city = sanitizeForPrompt(property.city || "", 80);
  const notes = sanitizeForPrompt(property.marketNotes || "", 600);
  const beds = property.beds ?? "—";
  const baths = property.baths ?? "—";
  const sqft = property.sqft ?? "—";
  const ev =
    property.estimatedValue != null && Number.isFinite(property.estimatedValue)
      ? `$${Math.round(property.estimatedValue).toLocaleString()}`
      : "—";

  return `${persona}

TASK: Produce a concise SELLER REPORT suitable for a homeowner (structured sections).
PROPERTY FACTS (do not invent beyond this):
- Address: ${address}
- City/area: ${city || "—"}
- Beds / Baths / Sqft: ${beds} / ${baths} / ${sqft}
- Estimated value (if provided): ${ev}
- Additional data: ${notes || "—"}

SECTIONS (use clear headings):
1) Executive summary (3–5 sentences)
2) Pricing strategy (bullet points)
3) Prep & presentation (bullet points)
4) Timeline & next steps (bullet points)
5) Risk factors / market caveats (short)

REQUIREMENTS:
- Professional, actionable, conversion-oriented
- If data is missing, say what you need instead of fabricating comps
- No discriminatory language; fair housing compliant
- Output markdown-style headings (##) for sections`;
}

export function leadExplanation(
  lead: LeadPromptInput,
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const name = sanitizeForPrompt(lead.name || "Lead", 80);
  const activity = sanitizeForPrompt(lead.activitySummary || "Limited activity data", 500);
  const score = lead.score != null ? String(lead.score) : "not provided";
  const intent = sanitizeForPrompt(lead.intent || "unknown", 40);
  const timeline = sanitizeForPrompt(lead.timeline || "unknown", 40);

  return `${persona}

TASK: Explain lead quality for an agent CRM (internal coaching tone).
LEAD: ${name}
SCORE (if provided): ${score}/100
INTENT LEVEL: ${intent}
TIMELINE SIGNAL: ${timeline}
ACTIVITY / SIGNALS: ${activity}

OUTPUT (markdown):
## Summary (2–3 sentences)
## Why this score (3–5 bullets)
## Recommended next action (1–2 bullets)
## What to verify (1–3 bullets)

Be specific and practical. Do not fabricate events not implied by the context.`;
}

export function cmaExplanation(
  data: CmaPromptInput,
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const addr = sanitizeForPrompt(data.subjectAddress || "Subject property", 200);
  const summary = sanitizeForPrompt(data.summary || "", 1200);
  const ev = data.estimatedValue != null ? `$${Math.round(data.estimatedValue).toLocaleString()}` : "—";
  const low = data.low != null ? `$${Math.round(data.low).toLocaleString()}` : "—";
  const high = data.high != null ? `$${Math.round(data.high).toLocaleString()}` : "—";
  const comps = data.compCount != null ? String(data.compCount) : "—";
  const ppsf =
    data.avgPricePerSqft != null && Number.isFinite(data.avgPricePerSqft)
      ? `$${Math.round(data.avgPricePerSqft).toLocaleString()}/sqft`
      : "—";

  return `${persona}

TASK: Explain a CMA result to a homeowner in plain language.
SUBJECT: ${addr}
ESTIMATED VALUE: ${ev}
RANGE: ${low} – ${high}
COMP COUNT (if given): ${comps}
AVG PRICE/SQFT (if given): ${ppsf}
RAW SUMMARY / DATA FROM SYSTEM:
${summary || "(none provided)"}

OUTPUT (markdown):
## What this means (short)
## How we got here (simple, no jargon wall)
## What affects value most (bullets)
## Suggested next step (one CTA question)

If data is thin, say so honestly. Output only the explanation.`;
}

export function notificationText(
  payload: { title?: string; bodyHint?: string; audience?: "agent" | "lead" },
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const title = sanitizeForPrompt(payload.title || "Update", 120);
  const hint = sanitizeForPrompt(payload.bodyHint || "", 400);
  const aud = payload.audience === "lead" ? "homeowner/lead" : "real estate agent";

  return `${persona}

TASK: Write a short in-app or push notification for a ${aud}.
TITLE HINT: ${title}
CONTEXT: ${hint || "—"}

REQUIREMENTS:
- Title: max 50 characters
- Body: max 180 characters, one sentence + optional second short sentence
- Output exactly two lines:
Line 1: TITLE: ...
Line 2: BODY: ...
No other text.`;
}
