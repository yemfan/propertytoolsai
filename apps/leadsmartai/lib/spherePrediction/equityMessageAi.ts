import { getOpenAIConfig } from "@/lib/ai/openaiClient";

import type { SphereSellerFactor } from "@/lib/spherePrediction/types";

/**
 * AI equity-update message generator for the SOI seller-prediction workflow.
 *
 * Takes a scored past_client / sphere contact (name, equity figures, tenure,
 * factor breakdown) and returns a personalized **draft** for the agent to
 * review — never auto-sends. The send action is a separate, explicit
 * agent click in a follow-up PR.
 *
 * Two outputs per call:
 *   - SMS: single short message, ≤320 chars
 *   - Email: subject + body, 2–4 short paragraphs
 *
 * Both share the same prompt context so the tone and equity numbers stay
 * consistent across channels.
 *
 * Uses raw OpenAI chat completions (matches `lib/aiReplyGenerator.ts` —
 * the codebase has not adopted the AI SDK yet; do NOT introduce it here
 * one-off without a broader migration plan). When OPENAI_API_KEY is unset,
 * falls back to deterministic templates so demos and tests work offline.
 */

export type EquityMessageInput = {
  /** What we call them — first name preferred. */
  contactFirstName: string | null;
  contactFullName: string;
  /** Address of the home they bought (used in the email subject). */
  closingAddress: string | null;
  /** What they paid at close, for the "you bought for" line. */
  closingPrice: number | null;
  /** Current AVM, for the "now worth ~" line. */
  avmCurrent: number | null;
  /** ISO date — used to phrase "since 2018" / "in spring 2020" style. */
  closingDate: string | null;
  /** Lifecycle stage for tone (past_client = warmer, sphere = lighter). */
  lifecycleStage: "past_client" | "sphere";
  /** The factor breakdown from the score engine — drives the "why now" line. */
  factors: ReadonlyArray<SphereSellerFactor>;
  /** Agent's display name / persona for the sign-off. */
  agentDisplayName: string | null;
};

export type EquityMessageDraft = {
  sms: string;
  emailSubject: string;
  emailBody: string;
  /** Whether OpenAI was used (false = deterministic fallback). */
  aiPowered: boolean;
};

function fmtMoney(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtYear(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return String(new Date(t).getUTCFullYear());
}

export function buildEquitySnapshot(
  input: Pick<EquityMessageInput, "closingPrice" | "avmCurrent" | "closingDate">,
): { line: string | null; deltaDollars: number | null; deltaPct: number | null } {
  const closing = input.closingPrice;
  const current = input.avmCurrent;
  if (!closing || !current || closing <= 0 || current <= 0) {
    return { line: null, deltaDollars: null, deltaPct: null };
  }
  const deltaDollars = current - closing;
  const deltaPct = deltaDollars / closing;
  if (deltaDollars <= 0) {
    return { line: null, deltaDollars, deltaPct };
  }
  const yearStr = fmtYear(input.closingDate);
  const sinceStr = yearStr ? ` since ${yearStr}` : "";
  const moneyStr = fmtMoney(current) ?? `$${current.toLocaleString()}`;
  const gainStr = fmtMoney(deltaDollars) ?? `$${deltaDollars.toLocaleString()}`;
  const pctStr = `${(deltaPct * 100).toFixed(0)}%`;
  return {
    line: `Worth roughly ${moneyStr} today — about ${gainStr} (${pctStr}) above what you paid${sinceStr}.`,
    deltaDollars,
    deltaPct,
  };
}

/**
 * Compress the factor breakdown into a single "why now" hint the prompt can
 * use. We pick the strongest non-equity factor (since equity is already
 * surfaced above) so the message has TWO distinct talking points instead of
 * doubling-down on equity. Falls back to equity if nothing else has weight.
 */
function topNonEquityFactor(
  factors: ReadonlyArray<SphereSellerFactor>,
): SphereSellerFactor | null {
  let best: SphereSellerFactor | null = null;
  for (const f of factors) {
    if (f.id === "equity_gain") continue;
    if (f.pointsEarned <= 0) continue;
    if (!best || f.pointsEarned > best.pointsEarned) best = f;
  }
  return best;
}

function firstNameOf(input: EquityMessageInput): string {
  if (input.contactFirstName?.trim()) return input.contactFirstName.trim();
  const first = input.contactFullName.split(/\s+/)[0]?.trim();
  return first || "there";
}

function fallbackDraft(input: EquityMessageInput): EquityMessageDraft {
  const name = firstNameOf(input);
  const equity = buildEquitySnapshot(input);
  const agent = input.agentDisplayName?.trim() || "your agent";
  const stageOpener =
    input.lifecycleStage === "past_client"
      ? `hope you're settling in well at ${input.closingAddress?.trim() || "the house"}.`
      : "hope all's good on your end.";

  const equityClause = equity.line
    ? ` Quick market note — ${equity.line.toLowerCase()}`
    : "";

  // SMS: single short message, soft CTA.
  const sms = [
    `Hi ${name}, ${stageOpener}${equityClause}`.trim(),
    `If you ever start thinking about your next move, I'm just a text away. — ${agent}`,
  ]
    .filter(Boolean)
    .join(" ");

  // Email: 2–3 paragraphs, slightly more formal.
  const subject = input.closingAddress
    ? `Quick update on ${input.closingAddress}`
    : "Quick market check-in";

  const equityParagraph = equity.line
    ? `A quick market check-in — ${equity.line}`
    : "A quick market check-in — values in your area have been moving and I wanted to share a snapshot.";

  const body = [
    `Hi ${name},`,
    "",
    equityParagraph,
    "",
    "If you've ever thought about exploring a move — upsize, downsize, or relocate — I'd love to share what we're seeing in the neighborhood. No pressure, just here when it's useful.",
    "",
    `— ${agent}`,
  ].join("\n");

  return { sms: sms.slice(0, 320), emailSubject: subject, emailBody: body, aiPowered: false };
}

/**
 * Build the user prompt the model sees. Exported so tests can lock down the
 * wording without spinning up the model.
 */
export function buildEquityPrompt(input: EquityMessageInput): string {
  const name = input.contactFullName;
  const equity = buildEquitySnapshot(input);
  const top = topNonEquityFactor(input.factors);
  const closingYear = fmtYear(input.closingDate);
  const closingAt = input.closingAddress?.trim();
  const lifecycle = input.lifecycleStage === "past_client" ? "past client" : "sphere contact";

  const lines: string[] = [
    `You are an experienced real-estate agent writing to a ${lifecycle}.`,
    `Their name: ${name}.`,
  ];
  if (closingAt) lines.push(`They bought ${closingAt}${closingYear ? ` in ${closingYear}` : ""}.`);
  if (equity.line) lines.push(`Equity story: ${equity.line}`);
  if (top) lines.push(`Other reason to reach out today: ${top.detail}`);
  lines.push(
    "",
    "Write TWO drafts in this exact JSON shape (no markdown fences):",
    `{"sms":"<single message, <=320 chars, warm + specific, soft CTA>",`,
    ` "emailSubject":"<<=72 chars, specific>",`,
    ` "emailBody":"<2-3 short paragraphs, plain text, friendly, no high-pressure language>"}`,
    "",
    "Constraints:",
    "- Reference the equity story explicitly when one is provided.",
    "- Do NOT use phrases like 'I have buyers for your house', 'limited time', or other pressure tactics.",
    "- Sign off the email with the agent's first name only (no robot persona).",
    `- Agent's name for sign-off: ${input.agentDisplayName?.trim() || "the agent"}.`,
    "- Match the tone to the lifecycle: past_client = warmer, more familiar; sphere = lighter, more general.",
  );
  return lines.join("\n");
}

function parseDraftJson(raw: string): { sms?: string; emailSubject?: string; emailBody?: string } | null {
  let t = raw.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    return {
      sms: typeof j.sms === "string" ? j.sms : undefined,
      emailSubject: typeof j.emailSubject === "string" ? j.emailSubject : undefined,
      emailBody: typeof j.emailBody === "string" ? j.emailBody : undefined,
    };
  } catch {
    return null;
  }
}

export async function generateEquityMessage(
  input: EquityMessageInput,
): Promise<EquityMessageDraft> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return fallbackDraft(input);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "You output only compact JSON objects for SOI seller equity-update drafts. No markdown.",
          },
          { role: "user", content: buildEquityPrompt(input) },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[equityMessageAi] OpenAI non-OK", res.status);
      return fallbackDraft(input);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = String(json.choices?.[0]?.message?.content ?? "").trim();
    const parsed = parseDraftJson(text);
    const fb = fallbackDraft(input);
    if (!parsed?.sms || !parsed.emailBody) {
      // Partial parse — keep whatever the model gave us, fill the rest from fallback.
      return {
        sms: (parsed?.sms ?? fb.sms).slice(0, 320),
        emailSubject: parsed?.emailSubject ?? fb.emailSubject,
        emailBody: parsed?.emailBody ?? fb.emailBody,
        aiPowered: Boolean(parsed?.sms || parsed?.emailBody),
      };
    }
    return {
      sms: parsed.sms.slice(0, 320),
      emailSubject: parsed.emailSubject ?? fb.emailSubject,
      emailBody: parsed.emailBody,
      aiPowered: true,
    };
  } catch (e) {
    console.warn("[equityMessageAi] generation error", e);
    return fallbackDraft(input);
  }
}
