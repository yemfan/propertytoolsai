import { predictLeadScore, type ConversionPrediction } from "@/lib/leadScoring";
import type { UserProfile } from "@/lib/userProfile";

export type OutreachTrigger = "high_intent" | "none";

export type TriggerCheckInput = {
  profile: UserProfile;
  /** Override threshold (default 70) */
  scoreThreshold?: number;
};

export type TriggerCheckResult = {
  shouldOutreach: boolean;
  prediction: ConversionPrediction;
  trigger: OutreachTrigger;
  /** Human-readable reason for automation logs */
  reason: string;
};

const DEFAULT_THRESHOLD = 70;

/**
 * Decide whether auto-outreach should run for this behavioral profile.
 * Rule: score > threshold ⇒ high intent ⇒ outreach eligible (subject to cooldown in `outreach` layer).
 */
export function checkTriggers(input: TriggerCheckInput): TriggerCheckResult {
  const threshold = input.scoreThreshold ?? DEFAULT_THRESHOLD;
  const prediction = predictLeadScore(input.profile);
  const shouldOutreach = prediction.score > threshold;
  const trigger: OutreachTrigger = shouldOutreach ? "high_intent" : "none";

  return {
    shouldOutreach,
    prediction,
    trigger,
    reason: shouldOutreach
      ? `Score ${prediction.score} > ${threshold} (${prediction.category} intent)`
      : `Score ${prediction.score} ≤ ${threshold}; no auto outreach`,
  };
}
