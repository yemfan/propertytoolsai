/**
 * Structured prompt templates for shared AI services.
 * User-controlled strings are sanitized before interpolation.
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

/** Inputs for a Financial Needs Analysis (FNA) report. */
export type FnaPromptInput = {
  clientName?: string | null;
  age?: number | null;
  spouseAge?: number | null;
  annualIncome?: number | null;
  spouseIncome?: number | null;
  dependents?: number | null;
  outstandingDebts?: number | null;
  mortgageBalance?: number | null;
  currentSavings?: number | null;
  current401k?: number | null;
  retirementAge?: number | null;
  monthlyExpenses?: number | null;
  existingCoverage?: number | null;
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
  goals?: string[] | null;
  /** Pre-computed numbers (deterministic) — supplied so the LLM does not hallucinate math. */
  computed?: {
    incomeReplacementNeed?: number;
    dimeNumber?: number;
    coverageGap?: number;
    retirementShortfall?: number;
    recommendedCoverage?: number;
  } | null;
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

function financialAdvisorPersona(language?: string): string {
  const lang = sanitizeForPrompt(language || "English", 40);
  return `You are a licensed financial services producer writing for a client review meeting.
Products in scope: indexed universal life (IUL), term life, fixed and indexed annuities, mutual funds.
Write in ${lang}. Tone: warm, professional, fiduciary-minded, plain-language. Avoid jargon when possible.
Never promise specific investment returns, tax outcomes, or guaranteed performance. Use phrases like
"may", "designed to", "based on the inputs you shared" when describing illustrations.
Compliance: this output is an educational analysis and not a contract, offer to sell, or substitute
for a prospectus or insurance illustration. Suitability is determined separately.`;
}

export function smsFollowUp(
  lead: LeadPromptInput,
  options?: { city?: string; language?: string }
): string {
  const persona = baseAgentPersona(options?.city, options?.language);
  const name = sanitizeForPrompt(lead.name || "there", 60);
  const addr = sanitizeForPrompt(lead.propertyAddress || "", 120);
  const city = sanitizeForPrompt(lead.city || "", 60);
  const activity = sanitizeForPrompt(
    lead.activitySummary || "recent interest in local market tools",
    MAX_SMS_CONTEXT
  );
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
  const activity = sanitizeForPrompt(
    lead.activitySummary || "engaged with your tools or content",
    400
  );
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
  const ev =
    data.estimatedValue != null ? `$${Math.round(data.estimatedValue).toLocaleString()}` : "—";
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

/** Financial Needs Analysis (FNA) report for a financial services prospect. */
export function fnaReport(
  input: FnaPromptInput,
  options?: { language?: string; advisorName?: string; agencyName?: string }
): string {
  const persona = financialAdvisorPersona(options?.language);
  const advisor = sanitizeForPrompt(options?.advisorName || "Your producer", 80);
  const agency = sanitizeForPrompt(options?.agencyName || "", 80);
  const client = sanitizeForPrompt(input.clientName || "Client", 80);
  const age = input.age ?? "—";
  const spouseAge = input.spouseAge ?? "—";
  const income =
    input.annualIncome != null && Number.isFinite(input.annualIncome)
      ? `$${Math.round(input.annualIncome).toLocaleString()}`
      : "—";
  const spouseIncome =
    input.spouseIncome != null && Number.isFinite(input.spouseIncome)
      ? `$${Math.round(input.spouseIncome).toLocaleString()}`
      : "—";
  const dependents = input.dependents ?? "—";
  const debts =
    input.outstandingDebts != null
      ? `$${Math.round(input.outstandingDebts).toLocaleString()}`
      : "—";
  const mortgage =
    input.mortgageBalance != null
      ? `$${Math.round(input.mortgageBalance).toLocaleString()}`
      : "—";
  const savings =
    input.currentSavings != null
      ? `$${Math.round(input.currentSavings).toLocaleString()}`
      : "—";
  const k401 =
    input.current401k != null
      ? `$${Math.round(input.current401k).toLocaleString()}`
      : "—";
  const retireAt = input.retirementAge ?? "—";
  const monthlyExp =
    input.monthlyExpenses != null
      ? `$${Math.round(input.monthlyExpenses).toLocaleString()}`
      : "—";
  const existing =
    input.existingCoverage != null
      ? `$${Math.round(input.existingCoverage).toLocaleString()}`
      : "—";
  const risk = sanitizeForPrompt(input.riskTolerance || "not specified", 30);
  const goals = (input.goals || [])
    .map((g) => sanitizeForPrompt(g, 80))
    .filter(Boolean)
    .join("; ") || "—";

  const c = input.computed || {};
  const incomeRepl =
    c.incomeReplacementNeed != null
      ? `$${Math.round(c.incomeReplacementNeed).toLocaleString()}`
      : "—";
  const dime =
    c.dimeNumber != null ? `$${Math.round(c.dimeNumber).toLocaleString()}` : "—";
  const gap =
    c.coverageGap != null ? `$${Math.round(c.coverageGap).toLocaleString()}` : "—";
  const retGap =
    c.retirementShortfall != null
      ? `$${Math.round(c.retirementShortfall).toLocaleString()}`
      : "—";
  const recCov =
    c.recommendedCoverage != null
      ? `$${Math.round(c.recommendedCoverage).toLocaleString()}`
      : "—";

  return `${persona}

TASK: Write a Financial Needs Analysis (FNA) for ${client}. This is an educational analysis,
not a sales document — but it should make the rationale for coverage and retirement planning clear.

CLIENT FACTS (do not invent beyond these):
- Name: ${client}
- Age: ${age}    Spouse age (if applicable): ${spouseAge}
- Household income: ${income} (spouse: ${spouseIncome})
- Dependents: ${dependents}
- Monthly household expenses: ${monthlyExp}
- Outstanding debts: ${debts}
- Mortgage balance: ${mortgage}
- Current liquid savings: ${savings}
- Retirement accounts (401k/IRA): ${k401}
- Target retirement age: ${retireAt}
- Existing life coverage: ${existing}
- Risk tolerance: ${risk}
- Stated goals: ${goals}

PRE-COMPUTED NUMBERS (use these exactly — do NOT recalculate or override):
- Income replacement need (10× household income): ${incomeRepl}
- DIME total (Debt + Income×10 + Mortgage + Education estimate): ${dime}
- Coverage gap (need − existing): ${gap}
- Retirement shortfall (projected need − projected savings at retirement): ${retGap}
- Recommended coverage amount: ${recCov}

OUTPUT FORMAT — markdown report with these sections (use ## headings):

## Executive Summary
3–4 sentences. Lead with the most important finding (income protection gap or retirement gap, whichever is larger).

## Income Protection Need
Explain why income replacement matters for a household with ${dependents} dependents.
Reference the pre-computed numbers (income replacement need, DIME, coverage gap).
Plain-language paragraph + a short bullet recap.

## Retirement Outlook
Discuss the gap between projected retirement need and projected savings at age ${retireAt}.
Note the retirement shortfall figure. One paragraph + 2–3 bullets on contributing factors.

## Coverage Recommendation
Suggest one primary product fit (IUL or term, or a combination) based on the recommended coverage amount,
the client's age, dependents, and risk tolerance. Briefly explain the trade-off (IUL = permanent + cash value;
term = lower premium, time-limited). Do NOT include premium quotes — those come from an illustration.

## Retirement Strategy Direction
Suggest a high-level direction (e.g., "explore an indexed annuity for principal protection on a portion of
the gap, while keeping growth-oriented mutual funds for the long horizon"). 2–3 sentences only.

## Next Steps
A short checklist (3–4 items) — what the producer and client do next:
1) Review carrier-issued illustration for the recommended coverage
2) Complete suitability questionnaire
3) Confirm beneficiary designations
4) Schedule annual review

## Important Notes (compliance footer)
2–3 sentences clarifying this is an educational analysis, not an offer of insurance, not a prospectus,
not a guarantee of returns; product suitability and final recommendation depend on carrier underwriting
and a signed suitability form. Do not include state-specific disclosures (those are appended by the
delivery system).

REQUIREMENTS:
- Do not invent numbers beyond what's provided or pre-computed.
- Do not promise specific returns or tax outcomes.
- Keep paragraphs short. Use bullets where they aid scanability.
- Total length 700–1100 words.
- Sign off with: "Prepared by ${advisor}${agency ? `, ${agency}` : ""}"
- Output the report only — no preamble.`;
}

/** Insurance/financial-services flavored SMS follow-up. */
export function financeSmsFollowUp(
  lead: LeadPromptInput & { product?: string | null },
  options?: { language?: string }
): string {
  const persona = financialAdvisorPersona(options?.language);
  const name = sanitizeForPrompt(lead.name || "there", 60);
  const activity = sanitizeForPrompt(
    lead.activitySummary || "recent interest in financial planning tools",
    MAX_SMS_CONTEXT
  );
  const product = sanitizeForPrompt(lead.product || "financial protection options", 60);

  return `${persona}

TASK: Write ONE SMS (max 300 characters) to follow up with a financial services prospect.
CONTEXT:
- Recipient: ${name}
- Topic / product interest: ${product}
- Observed activity: ${activity}

REQUIREMENTS:
- One short text, no subject line
- Natural, conversational, never pushy
- End with ONE soft question (e.g., offering a short consult)
- No emojis, no markdown, no all-caps
- Do NOT quote prices, guaranteed returns, or specific policy terms
- Do NOT include state-specific disclosures (the delivery system appends them)
- Output ONLY the SMS body text.`;
}

/** Insurance/financial-services flavored email follow-up. */
export function financeEmailFollowUp(
  lead: LeadPromptInput & { product?: string | null },
  options?: { language?: string }
): string {
  const persona = financialAdvisorPersona(options?.language);
  const name = sanitizeForPrompt(lead.name || "there", 80);
  const product = sanitizeForPrompt(lead.product || "financial protection options", 60);
  const activity = sanitizeForPrompt(
    lead.activitySummary || "engaged with your planning tools",
    400
  );

  return `${persona}

TASK: Write a follow-up email body for a financial services prospect.
CONTEXT:
- Recipient: ${name}
- Topic / product interest: ${product}
- Activity: ${activity}

REQUIREMENTS:
- First line: Subject: <concise subject>
- Blank line, then body (150–300 words)
- Single primary CTA (book a 15-min consult, request an FNA, or reply with questions)
- Educational, not promotional
- No specific premium quotes or guaranteed returns
- No state disclosures (system appends them)
- Output ONLY the email (subject + body), no preamble.`;
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

