import type { EmailAssistantIntent } from "./types";

export function inferEmailIntentHeuristic(subject: string, body: string): EmailAssistantIntent {
  const t = `${subject} ${body}`.toLowerCase();
  if (/(home value|what.?s my home worth|estimate my home|seller report)/.test(t)) return "seller_home_value";
  if (/(sell my home|list my home|listing appointment|list with you)/.test(t)) return "seller_list_home";
  if (/(is this available|tour|showing|property details|listing)/.test(t)) return "buyer_listing_inquiry";
  if (/(mortgage|loan|preapproval|pre-approval|afford|financing)/.test(t)) return "buyer_financing";
  if (/(appointment|call me|schedule|talk today|meeting)/.test(t)) return "appointment";
  if (/(documents|disclosures|report|contract|agreement|forms)/.test(t)) return "document_request";
  if (/(help|issue|problem|support)/.test(t)) return "support";
  return "unknown";
}
