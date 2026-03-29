export function isEmailOptOut(subject: string, body: string) {
  const t = `${subject} ${body}`.toLowerCase().trim();
  return /(unsubscribe|stop contacting|do not contact|remove me|opt out)/.test(t);
}

export function emailNeedsHumanEscalation(subject: string, body: string) {
  const t = `${subject} ${body}`.toLowerCase();
  return /(attorney|lawsuit|legal|fraud|scam|complaint|breach|urgent dispute|report you)/.test(t);
}
