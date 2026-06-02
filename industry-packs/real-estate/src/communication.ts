import { needsHumanFromText } from "@helm/dna-communication";

// Real-estate message-intent taxonomy + classifiers. INDUSTRY-SPECIFIC — lives in the pack,
// never in Core. The pack composes Core's channel-agnostic primitives (escalation) with
// RE-specific knowledge (the intent vocabulary). Moved verbatim from leadsmartai lib/ai-sms.

export type SmsAssistantIntent =
  | "buyer_listing_inquiry"
  | "buyer_financing"
  | "seller_home_value"
  | "seller_list_home"
  | "support"
  | "appointment"
  | "unknown";

/** Heuristic real-estate SMS intent classifier. */
export function inferIntentHeuristic(text: string): SmsAssistantIntent {
  const t = text.toLowerCase();
  if (/(home value|what.?s my home worth|estimate my home|sell my home|list my home)/.test(t)) {
    return "seller_home_value";
  }
  if (/(sell|listing agent|list with you)/.test(t)) return "seller_list_home";
  if (/(available|tour|showing|see the house|property still available|listing)/.test(t)) {
    return "buyer_listing_inquiry";
  }
  if (/(mortgage|loan|preapproval|pre-approval|afford|financing)/.test(t)) return "buyer_financing";
  if (/(appointment|call me|schedule|talk today)/.test(t)) return "appointment";
  if (/(help|issue|problem|support)/.test(t)) return "support";
  return "unknown";
}

/**
 * Pack-over-Core extension: combine the RE intent taxonomy (this pack) with Core's
 * escalation primitive (`@helm/dna-communication`) into one inbound-SMS triage result.
 * This is the dependency direction the architecture requires: pack → core (Core never
 * imports this pack — enforced by scripts/check-boundaries.mjs).
 */
export function triageInboundSms(text: string): {
  intent: SmsAssistantIntent;
  needsHuman: boolean;
} {
  return { intent: inferIntentHeuristic(text), needsHuman: needsHumanFromText(text) };
}
