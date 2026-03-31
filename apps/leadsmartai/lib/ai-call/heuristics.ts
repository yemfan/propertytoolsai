import { needsHumanFromText } from "./escalation";
import type { VoiceCallIntent, VoiceIntentRole } from "./types";

/** Map CRM intent to a coarse role for filters and hot-path messaging. */
export function voiceIntentCategory(intent: VoiceCallIntent): VoiceIntentRole {
  switch (intent) {
    case "buyer_listing_inquiry":
    case "buyer_financing":
      return "buyer";
    case "seller_home_value":
    case "seller_list_home":
      return "seller";
    case "appointment":
      return "appointment";
    case "support":
      return "support";
    case "unknown":
    default:
      return "unknown";
  }
}

export function classifyCallIntentFromTranscript(text: string): VoiceCallIntent {
  const t = text.toLowerCase();
  if (/(loan|mortgage|financ|pre-approval|preapproval|lender|interest rate|underwrit)/.test(t)) {
    return "buyer_financing";
  }
  if (/(list my|sell my home|sell our house|listing appointment|want to list)/.test(t)) {
    return "seller_list_home";
  }
  if (/(worth|home value|cma|comparables|valuation|what('s| is) my (home|house) worth)/.test(t)) {
    return "seller_home_value";
  }
  if (/(appointment|schedule|book (a |)|calendar)/.test(t)) return "appointment";
  if (/(support|billing|account|bug|app problem|login|password)/.test(t)) return "support";
  if (/(showing|tour|see (the |)(house|home|property|listing)|open house)/.test(t)) {
    return "buyer_listing_inquiry";
  }
  if (/(buy|buying|purchase|looking (for|at) (a |)(home|house|condo|property))/.test(t)) {
    return "buyer_listing_inquiry";
  }
  if (/(sell|selling|list (my|our))/.test(t)) return "seller_list_home";
  if (t.replace(/\s+/g, "").length > 3) return "unknown";
  return "unknown";
}

const HOT_INTENTS: VoiceCallIntent[] = [
  "buyer_listing_inquiry",
  "buyer_financing",
  "seller_home_value",
  "seller_list_home",
  "appointment",
];

export function detectHotLeadFromCall(text: string, intent: VoiceCallIntent): boolean {
  if (needsHumanFromText(text)) return true;
  const t = text.toLowerCase();
  if (HOT_INTENTS.includes(intent)) return true;
  if (/(cash offer|pre-approval|make an offer|under contract|today|asap|right now|this week)/.test(t)) {
    return true;
  }
  return false;
}
