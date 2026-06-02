// Channel-agnostic messaging compliance + safety. Pure (no I/O, tenancy, or framework),
// so it is shared verbatim across SMS / email / voice AND across apps with different
// databases (Core org_id vs leadsmartai agent_id). Behavior preserved from leadsmartai's
// lib/ai-sms/safety.ts + lib/ai-email/safety.ts.
//
// NOTE on the Core/Pack fence: the *intent classifiers* that lived beside these
// (seller_home_value, buyer_listing_inquiry, mortgage, CMA, …) are real-estate-specific
// and belong in @helm/pack-real-estate — NOT here. Only the universal compliance/escalation
// primitives are Core.

/** SMS opt-out — exact keyword match: "stop", "unsubscribe", "end", "quit", "cancel". */
export function shouldStopMessaging(body: string): boolean {
  return /^(stop|unsubscribe|end|quit|cancel)$/i.test(body.trim());
}

/** SMS message that should be handed to a human (legal/anger/fraud signals). */
export function needsHumanEscalation(body: string): boolean {
  const t = body.toLowerCase();
  return /(lawsuit|attorney|complaint|fraud|scam|angry|terrible|file against|urgent now)/.test(t);
}

/** Email opt-out — phrase match across subject + body. */
export function isEmailOptOut(subject: string, body: string): boolean {
  const t = `${subject} ${body}`.toLowerCase().trim();
  return /(unsubscribe|stop contacting|do not contact|remove me|opt out)/.test(t);
}

/** Email that should be handed to a human. */
export function emailNeedsHumanEscalation(subject: string, body: string): boolean {
  const t = `${subject} ${body}`.toLowerCase();
  return /(attorney|lawsuit|legal|fraud|scam|complaint|breach|urgent dispute|report you)/.test(t);
}

// Sensitive: legal / fraud / discrimination / harassment — route to a human regardless of channel.
const SENSITIVE: RegExp[] = [
  /\b(lawsuit|attorney|lawyer|legal action|sue|discriminat|fair housing|hud|harass|stalk|threat)\b/i,
  /\b(fraud|scam|police|fcc|ftc)\b/i,
];

/**
 * Stricter human-escalation check (used by voice/call transcripts). Independent of any
 * sales "hot" intent. Industry-agnostic — the RE/FS hot-lead logic composes this from a pack.
 */
export function needsHumanFromText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const re of SENSITIVE) {
    if (re.test(t)) return true;
  }
  if (/\b(angry|furious|terrible|worst|never using)\b/i.test(t) && t.length > 40) return true;
  return false;
}
