import type { SmsAssistantIntent } from "./types";

export function inferIntentHeuristic(text: string): SmsAssistantIntent {
  const t = text.toLowerCase();
  if (/(home value|what.?s my home worth|estimate my home|sell my home|list my home)/.test(t)) {
    return "seller_home_value";
  }
  if (/(sell|listing agent|list with you)/.test(t)) {
    return "seller_list_home";
  }
  if (/(available|tour|showing|see the house|property still available|listing)/.test(t)) {
    return "buyer_listing_inquiry";
  }
  if (/(mortgage|loan|preapproval|pre-approval|afford|financing)/.test(t)) {
    return "buyer_financing";
  }
  if (/(appointment|call me|schedule|talk today)/.test(t)) {
    return "appointment";
  }
  if (/(help|issue|problem|support)/.test(t)) {
    return "support";
  }
  return "unknown";
}
