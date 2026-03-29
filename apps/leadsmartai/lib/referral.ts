/**
 * Referral + growth helpers (shared algorithms from @repo/growth; DB in ./growth/referralDb).
 */
export {
  generateReferralCode,
  normalizeReferralCode,
  isValidReferralCodeFormat,
  extractReferralFromSearchParams,
  referralQueryParamNames,
} from "@repo/growth";

export { computeViralMetrics, type ViralSnapshot } from "@repo/growth";
