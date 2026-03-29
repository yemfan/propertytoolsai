export function shouldStopMessaging(body: string) {
  return /^(stop|unsubscribe|end|quit|cancel)$/i.test(body.trim());
}

export function needsHumanEscalation(body: string) {
  const t = body.toLowerCase();
  return /(lawsuit|attorney|complaint|fraud|scam|angry|terrible|file against|urgent now)/.test(t);
}
