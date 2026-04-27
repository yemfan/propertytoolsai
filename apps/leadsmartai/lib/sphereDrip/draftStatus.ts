import type { ReviewPolicy } from "@/lib/agent-messaging/types";

/**
 * Pure resolver for the message-draft status sphere drip should write.
 *
 * Mirrors the scheduler's resolveDraftStatus, narrowed to the sphere
 * category (the only one this cadence ever runs in). Sphere drip
 * doesn't have per-template review overrides, so the resolution is:
 *
 *   review                       → pending  (queue for agent review)
 *   autosend                     → approved (sphere-drafts-sender will deliver)
 *   per_category w/ sphere setting → respect the per-category setting
 */
export function resolveDraftStatusForDrip(args: {
  reviewPolicy: ReviewPolicy;
  sphereCategory: "review" | "autosend" | null;
}): "pending" | "approved" {
  if (args.reviewPolicy === "per_category" && args.sphereCategory) {
    return args.sphereCategory === "autosend" ? "approved" : "pending";
  }
  if (args.reviewPolicy === "autosend") return "approved";
  return "pending";
}
