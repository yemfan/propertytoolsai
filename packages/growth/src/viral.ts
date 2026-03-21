/**
 * Simple viral / growth metrics from counts (no I/O).
 */

export type ViralSnapshot = {
  /** Approximate invites per user who shared (shares / unique_sharers) */
  invitesPerSharer: number;
  /** Signups attributed to referral / total signups (0–1) */
  referralShareOfSignups: number;
  /** Heuristic K-style coefficient: invitesPerSarers * conversionToSignup */
  viralCoefficientEstimate: number;
};

export function computeViralMetrics(input: {
  totalSignups: number;
  referralSignups: number;
  totalShares: number;
  uniqueSharers: number;
}): ViralSnapshot {
  const { totalSignups, referralSignups, totalShares, uniqueSharers } = input;
  const invitesPerSharer = uniqueSharers > 0 ? totalShares / uniqueSharers : 0;
  const referralShareOfSignups = totalSignups > 0 ? referralSignups / totalSignups : 0;
  const conversionProxy = totalSignups > 0 && totalShares > 0 ? totalSignups / totalShares : 0;
  const viralCoefficientEstimate = Number((invitesPerSharer * conversionProxy).toFixed(3));

  return {
    invitesPerSharer: Number(invitesPerSharer.toFixed(2)),
    referralShareOfSignups: Number(referralShareOfSignups.toFixed(3)),
    viralCoefficientEstimate,
  };
}
