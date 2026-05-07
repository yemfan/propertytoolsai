/**
 * Inbound-email intent classifier.
 *
 * Two layers:
 *   1. Keyword + heuristic (this file). Deterministic, free, ~80%
 *      coverage on real-world emails.
 *   2. AI overlay (`aiClassify.ts`, Phase 2B-3). Single Claude haiku
 *      call invoked only when the keyword pass returns `unknown` AND
 *      there's signal worth burning the call on. ~95% coverage when
 *      both layers run.
 *
 * The agent always reviews the resulting task before any extraction
 * → draft creation, so false positives at either layer just create
 * a slightly-mistitled review task, not a wrong offer.
 */

export type InboundIntent =
  | "offer_received"
  | "listing_signed"
  | "showing_requested"
  | "unknown";

const OFFER_KEYWORDS = [
  "offer",
  "purchase agreement",
  "rpa",
  "earnest money",
  "counter",
  "counter-offer",
  "counteroffer",
  "ratified",
];

const LISTING_KEYWORDS = [
  "listing agreement",
  "rla",
  "residential listing",
  "exclusive right to sell",
  "list price",
  "exclusive agency",
];

const SHOWING_KEYWORDS = [
  "showing request",
  "request a showing",
  "request to show",
  "schedule a showing",
  "schedule a tour",
  "schedule a viewing",
  "tour request",
  "showing time",
  "showing appointment",
];

function matchesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  for (const n of needles) {
    if (lower.includes(n)) return true;
  }
  return false;
}

/**
 * Classify by subject + body. Order matters when keywords overlap:
 * offer keywords are most specific (an offer email rarely says
 * "schedule a showing" without also saying "offer"), so check
 * offers first, then listings, then showings.
 */
export function classifyInboundEmail(input: {
  subject: string | null;
  text: string | null;
  hasPdfAttachment: boolean;
}): InboundIntent {
  const haystack = `${input.subject ?? ""}\n${input.text ?? ""}`;

  if (matchesAny(haystack, OFFER_KEYWORDS)) return "offer_received";
  if (matchesAny(haystack, LISTING_KEYWORDS)) return "listing_signed";
  if (matchesAny(haystack, SHOWING_KEYWORDS)) return "showing_requested";

  // PDF attachment without offer/listing keywords often signals a
  // contract that the agent forwarded for filing — surface it as
  // unknown rather than guessing offer_received.
  return "unknown";
}

/** Human-friendly label for the intent — used in task titles. */
export function intentLabel(intent: InboundIntent): string {
  switch (intent) {
    case "offer_received":
      return "Offer";
    case "listing_signed":
      return "Listing agreement";
    case "showing_requested":
      return "Showing request";
    case "unknown":
      return "Email";
  }
}
