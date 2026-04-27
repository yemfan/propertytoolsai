/**
 * Pure copy-formatter for the instant SMS auto-reply we send when a
 * visitor signs into an open house. This is the speed-to-lead beat —
 * fires within seconds of the form post, while the visitor is still
 * holding their phone at the door.
 *
 * BoldTrail/Lofty parity: their open-house flow texts the visitor
 * immediately. Most CRMs send the first text from cron (minutes later);
 * the gap is small but the perception isn't.
 *
 * Distinct from `runFollowups.ts`'s 2-26h thank-you and 72-96h check-in
 * — those are post-event nurture beats, this one is at-the-door.
 *
 * Constraints:
 *   * SMS budget: keep under 160 chars when we can (1 segment). Two
 *     segments is acceptable when the property address is long; three
 *     is not — the formatter tightens automatically.
 *   * Tone: warm, first-person from the agent, conversational. NOT a
 *     marketing template.
 *   * Always opens a thread: end with an invitation to reply so the
 *     agent's inbox lights up if the visitor has a question.
 */

export type InstantReplyInput = {
  /** Visitor's name as captured. May be a single first name, "First Last", or null. */
  visitorName: string | null;
  /** Property address (the open-house listing). Required — included so the
   *  visitor sees the right context if multiple agents/houses sent texts. */
  propertyAddress: string;
  /** Agent first name to sign the message. Falls back to "your agent" when
   *  the agent row has no first_name (rare — onboarding requires it). */
  agentFirstName: string | null;
  /** Agent brokerage. Used only as a tasteful trailing tag when room allows. */
  agentBrokerage?: string | null;
};

const MAX_SEGMENT_CHARS = 160;
const MAX_TWO_SEGMENT_CHARS = 320;

/**
 * Build the SMS body. Pure — no side effects, no IO. Easy to unit test
 * the exact wording so tone changes don't ship by accident.
 */
export function formatInstantReplySms(input: InstantReplyInput): string {
  const greeting = buildGreeting(input.visitorName);
  const agentTag = (input.agentFirstName ?? "").trim() || "your agent";

  // Trim address to a reasonable preview. Keep through the city when present
  // ("123 Main St, Austin"), drop ", TX 78701" tail to save segment budget.
  const shortAddr = shortenAddress(input.propertyAddress);

  // Variant A — full warmth, fits in 1 segment for short addresses.
  const v1 =
    `${greeting} Thanks for stopping by ${shortAddr} today! ` +
    `This is ${agentTag}. Any questions about the home, just reply here. — ${agentTag}`;
  if (v1.length <= MAX_SEGMENT_CHARS) return v1;

  // Variant B — drop the closing signature (we already named the agent).
  const v2 =
    `${greeting} Thanks for stopping by ${shortAddr} today! ` +
    `This is ${agentTag}. Any questions about the home, just reply here.`;
  if (v2.length <= MAX_SEGMENT_CHARS) return v2;

  // Variant C — drop the address shorthand to "the open house".
  const v3 =
    `${greeting} Thanks for stopping by the open house today! ` +
    `This is ${agentTag}. Any questions about the home, just reply here.`;
  if (v3.length <= MAX_SEGMENT_CHARS) return v3;

  // Last resort — guaranteed under 2 segments. Trims to be safe.
  return v3.slice(0, MAX_TWO_SEGMENT_CHARS);
}

/**
 * Greeting picks the visitor's first name when present, otherwise a
 * neutral "Hi!". Splits on whitespace; "Mary Sue Johnson" → "Mary".
 */
function buildGreeting(name: string | null): string {
  if (!name) return "Hi!";
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.length ? `Hi ${first}!` : "Hi!";
}

/**
 * Shortens "123 Main St, Austin, TX 78701" → "123 Main St, Austin".
 * If there's no comma, returns as-is. If there's only one comma, returns
 * up to that comma's clause (the street). Idea: keep the part the visitor
 * recognizes ("the house I just visited") and drop redundant state/zip.
 */
function shortenAddress(addr: string): string {
  const trimmed = addr.trim();
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  // 3+ parts → keep street + city.
  return `${parts[0]}, ${parts[1]}`;
}

/**
 * Eligibility check — pure. The route can call this before queueing the
 * send so we don't double-decide gating logic in two places.
 *
 *   * Must have phone (no SMS without one)
 *   * Must have marketing consent (TCPA — visitor explicitly opted in)
 *   * Must NOT be buyer-agented (Realtor® code-of-ethics; same gate the
 *     contact-upsert flow uses)
 */
export function isEligibleForInstantReply(visitor: {
  phone: string | null;
  marketingConsent: boolean;
  isBuyerAgented: boolean;
}): boolean {
  if (!visitor.phone) return false;
  if (!visitor.marketingConsent) return false;
  if (visitor.isBuyerAgented) return false;
  return true;
}
