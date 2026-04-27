import { getOpenAIConfig } from "@/lib/ai/openaiClient";

import type { BuyerPredictionFactor } from "@/lib/buyerPrediction/types";

/**
 * AI buyer-outreach message generator. Dual of the seller-side equity-update
 * generator (`lib/spherePrediction/equityMessageAi.ts`).
 *
 *   Seller message:  "your home is worth $X — let's talk about your equity"
 *   Buyer message:   "you might be relocating / upsizing — let me help with
 *                     your next home"
 *
 * The buyer side keys off the strongest buyer-intent signal (job_change,
 * life_event_other, equity_milestone, refi_detected) rather than equity
 * deltas. The signal label drives the message angle:
 *
 *   job_change      → relocation / new-market hunt
 *   life_event_other→ bigger family, downsize, retirement repositioning
 *   equity_milestone→ "you've built equity — ready to upgrade?"
 *   refi_detected   → cash-out repurpose ("if part of that's earmarked for
 *                     the next home, here's the market")
 *
 * Generator + fallback parity:
 *   - When OPENAI_API_KEY is set, calls chat completions and parses JSON.
 *   - When unset, falls back to deterministic templates so demos and tests
 *     stay green offline.
 *
 * Same raw-fetch pattern as `lib/aiReplyGenerator.ts` and the seller-side
 * generator — keeps the AI surface area consistent.
 */

export type BuyerOutreachInput = {
  /** What we call them — first name preferred. */
  contactFirstName: string | null;
  contactFullName: string;
  /** Address of the home they currently own (used for context, not for the lead). */
  closingAddress: string | null;
  /** What they paid at close — context for the equity angle. */
  closingPrice: number | null;
  /** Latest AVM — equity-to-upgrade signal when set. */
  avmCurrent: number | null;
  /** ISO date — used for "since YYYY" framing. */
  closingDate: string | null;
  /** Lifecycle stage for tone (past_client = warmer, sphere = lighter). */
  lifecycleStage: "past_client" | "sphere";
  /** Buyer-prediction factor breakdown — drives the "why now" angle. */
  factors: ReadonlyArray<BuyerPredictionFactor>;
  /** Signal type that scored highest, when known. Drives the message angle. */
  topSignalType?: string | null;
  /** Agent's display name / persona for the sign-off. */
  agentDisplayName: string | null;
};

export type BuyerOutreachDraft = {
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

/**
 * Pure: derive the equity figure for a buyer's "ready to upgrade" framing.
 * Returns null when there's no positive equity to talk about — same guard
 * as the seller-side `buildEquitySnapshot` (no negative-spin lines).
 */
export function buildEquityToUpgradeSnapshot(
  input: Pick<BuyerOutreachInput, "closingPrice" | "avmCurrent" | "closingDate">,
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
  const gainStr = fmtMoney(deltaDollars) ?? `$${deltaDollars.toLocaleString()}`;
  const pctStr = `${(deltaPct * 100).toFixed(0)}%`;
  return {
    line: `That's about ${gainStr} (${pctStr}) of equity built up${sinceStr} — meaningful headroom for a next move.`,
    deltaDollars,
    deltaPct,
  };
}

/**
 * Pure: pick the top scoring buyer-intent factor (excluding equity, which is
 * its own framing). Lets the prompt + fallback have a "why now" hook
 * distinct from the equity story.
 */
function topNonEquityFactor(
  factors: ReadonlyArray<BuyerPredictionFactor>,
): BuyerPredictionFactor | null {
  let best: BuyerPredictionFactor | null = null;
  for (const f of factors) {
    if (f.id === "equity_to_upgrade") continue;
    if (f.pointsEarned <= 0) continue;
    if (!best || f.pointsEarned > best.pointsEarned) best = f;
  }
  return best;
}

function firstNameOf(input: BuyerOutreachInput): string {
  if (input.contactFirstName?.trim()) return input.contactFirstName.trim();
  const first = input.contactFullName.split(/\s+/)[0]?.trim();
  return first || "there";
}

/**
 * Map the strongest signal to a message-angle key. Pure helper — exported
 * so the prompt and the fallback agree on which angle they're writing.
 */
export type BuyerOutreachAngle =
  | "relocation"
  | "life_change"
  | "equity_upgrade"
  | "cash_out_move"
  | "general_check_in";

export function pickOutreachAngle(input: BuyerOutreachInput): BuyerOutreachAngle {
  if (input.topSignalType === "job_change") return "relocation";
  if (input.topSignalType === "life_event_other") return "life_change";
  if (input.topSignalType === "refi_detected") return "cash_out_move";
  // No explicit signal — equity_milestone or none → fall back to equity-upgrade
  // when we have a positive equity figure, otherwise general check-in.
  const eq = buildEquityToUpgradeSnapshot(input);
  if (eq.line) return "equity_upgrade";
  return "general_check_in";
}

function fallbackDraft(input: BuyerOutreachInput): BuyerOutreachDraft {
  const name = firstNameOf(input);
  const angle = pickOutreachAngle(input);
  const equity = buildEquityToUpgradeSnapshot(input);
  const agent = input.agentDisplayName?.trim() || "your agent";

  // Per-angle SMS + email shells. Each stays under the SMS 320-char cap.
  let sms: string;
  let subject: string;
  let body: string;

  switch (angle) {
    case "relocation":
      sms = `Hi ${name}, heard you might be on the move. If a relocation is in the cards — even just exploring — happy to share what your home could trade for and what your next market looks like. Reply anytime. — ${agent}`;
      subject = "Quick check-in if you're thinking about a move";
      body = [
        `Hi ${name},`,
        "",
        "I caught a signal that you might be relocating — totally fine if that's not happening, but wanted to reach out either way.",
        "",
        "If a move is on the table, two things I can do quickly: (1) get you a current value snapshot on your place, and (2) loop you in with a great agent in the destination market. No rush, no pressure.",
        "",
        `— ${agent}`,
      ].join("\n");
      break;

    case "life_change":
      sms = `Hi ${name}, a quick check-in. If anything's shifting on the home front — kids, downsizing, anything in between — happy to talk options. Reply anytime. — ${agent}`;
      subject = "Whenever the next chapter feels right";
      body = [
        `Hi ${name},`,
        "",
        "Just a friendly check-in. Sometimes life has a way of nudging the housing question — bigger family, smaller place, different layout, same place but updated.",
        "",
        "If any of that's on your mind, I'd love to chat through what your options actually look like at today's prices and rates. No pressure to decide anything.",
        "",
        `— ${agent}`,
      ].join("\n");
      break;

    case "equity_upgrade":
      sms = equity.line
        ? `Hi ${name}, the market's been kind to ${input.closingAddress?.trim() || "your place"}. ${equity.line} If a move-up's been on your mind, I can run real numbers for you. — ${agent}`
        : `Hi ${name}, your place has built solid equity. If a move-up's been on your mind, I can run the numbers — current value, what your next home looks like at today's rates, all of it. — ${agent}`;
      subject = `Equity update on ${input.closingAddress?.trim() || "your home"}`;
      body = [
        `Hi ${name},`,
        "",
        equity.line
          ? `A quick note from the market — ${equity.line.toLowerCase()}`
          : "A quick note from the market — your home has been steadily appreciating.",
        "",
        "If you've thought about a move-up at any point, I can put real numbers behind it: what your place would list for, what your monthly looks like at today's rates, and the inventory in the neighborhoods you'd actually consider.",
        "",
        `— ${agent}`,
      ].join("\n");
      break;

    case "cash_out_move":
      sms = `Hi ${name}, saw signs you've been working on financing. If part of that's earmarked for a next-home move, I can run numbers — current value, what's on the market, the math at today's rates. — ${agent}`;
      subject = "If a next-home move is in the picture";
      body = [
        `Hi ${name},`,
        "",
        "Quick reach-out — sometimes financing moves are the leading signal that a buyer's getting ready for their next home.",
        "",
        "If that's where you're headed, I'm happy to put together a snapshot: what your place would list for, the inventory in the neighborhoods you'd consider, and how the monthly math actually shakes out at today's rates.",
        "",
        `— ${agent}`,
      ].join("\n");
      break;

    case "general_check_in":
    default:
      sms = `Hi ${name}, just a quick check-in. If a next move's on your mind — even just exploring — happy to share what the market looks like for both sides. — ${agent}`;
      subject = "Quick check-in";
      body = [
        `Hi ${name},`,
        "",
        "Just a friendly check-in. If a next move has crossed your mind at any point, I can put real numbers behind it: current value, today's rates, and what the inventory looks like.",
        "",
        "No urgency — happy to be a resource whenever it's useful.",
        "",
        `— ${agent}`,
      ].join("\n");
      break;
  }

  return {
    sms: sms.slice(0, 320),
    emailSubject: subject,
    emailBody: body,
    aiPowered: false,
  };
}

/**
 * Build the user prompt the model sees. Exported so tests can lock the
 * structure without spinning up the model.
 */
export function buildBuyerOutreachPrompt(input: BuyerOutreachInput): string {
  const name = input.contactFullName;
  const angle = pickOutreachAngle(input);
  const equity = buildEquityToUpgradeSnapshot(input);
  const top = topNonEquityFactor(input.factors);
  const closingYear = fmtYear(input.closingDate);
  const closingAt = input.closingAddress?.trim();
  const lifecycle = input.lifecycleStage === "past_client" ? "past client" : "sphere contact";

  const lines: string[] = [
    `You help real-estate agents reach out to a ${lifecycle} who's likely to BUY their next home in the coming months.`,
    `Their name: ${name}.`,
  ];
  if (closingAt) lines.push(`They currently own ${closingAt}${closingYear ? ` (bought ${closingYear})` : ""}.`);
  if (equity.line) lines.push(`Equity context (use only when relevant to angle): ${equity.line}`);
  if (top) lines.push(`Strongest non-equity buyer signal today: ${top.detail}`);
  lines.push(
    `Message angle: ${angle.replace(/_/g, " ")}.`,
    "",
    "Write TWO drafts in this exact JSON shape (no markdown fences):",
    `{"sms":"<single message, <=320 chars, warm + low-pressure, soft CTA>",`,
    ` "emailSubject":"<<=72 chars, specific>",`,
    ` "emailBody":"<2-3 short paragraphs, plain text, friendly, no high-pressure language>"}`,
    "",
    "Constraints:",
    "- Match the tone to the angle (relocation = practical/helpful; life_change = gentle; equity_upgrade = market-update; cash_out_move = financing-aware; general_check_in = warm + open-ended).",
    "- Do NOT use phrases like 'I have buyers for your house' (that's a SELLER pitch — wrong audience).",
    "- Do NOT use phrases like 'limited time', 'don't miss out', or other pressure tactics.",
    "- Sign off with the agent's first name only.",
    `- Agent's name for sign-off: ${input.agentDisplayName?.trim() || "the agent"}.`,
    "- Match the lifecycle: past_client = warmer/familiar; sphere = lighter/more general.",
  );
  return lines.join("\n");
}

function parseDraftJson(raw: string): {
  sms?: string;
  emailSubject?: string;
  emailBody?: string;
} | null {
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

export async function generateBuyerOutreachMessage(
  input: BuyerOutreachInput,
): Promise<BuyerOutreachDraft> {
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
              "You output only compact JSON objects for SOI buyer-outreach drafts. No markdown.",
          },
          { role: "user", content: buildBuyerOutreachPrompt(input) },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[buyerOutreachAi] OpenAI non-OK", res.status);
      return fallbackDraft(input);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = String(json.choices?.[0]?.message?.content ?? "").trim();
    const parsed = parseDraftJson(text);
    const fb = fallbackDraft(input);
    if (!parsed?.sms || !parsed.emailBody) {
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
    console.warn("[buyerOutreachAi] generation error", e);
    return fallbackDraft(input);
  }
}
