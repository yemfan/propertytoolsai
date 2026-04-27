/**
 * Sphere drip cadence — pure data + pure helpers.
 *
 * The "both_high" cohort surfaced by the sphere-monetization view (PR #163)
 * are past clients / sphere who score high on BOTH the seller-prediction
 * and buyer-prediction engines. They're concurrent sell-then-buy candidates
 * — the agent's biggest leverage. Without a structured cadence the agent
 * eyeballs the list each week and the contacts decay.
 *
 * The 6-step cadence below is a pragmatic starting point — modeled on the
 * "8x8" + "33-touch" patterns that successful past-client farming agents
 * use, compressed to 30 days because both_high contacts are time-sensitive
 * (a job change driving a buy WILL close in 90 days, with you or someone
 * else). The exact spacing and channel mix are kept here as data so it's
 * easy to A/B vs. a "v2" cadence in a future PR.
 *
 * Send pipeline is OUT-OF-SCOPE in the migration that landed alongside
 * this. The cadence definitions still ship complete (channel + body
 * templates) so the agent can act on `next_due_at` manually until the
 * cron-driven processor lands.
 */

import type { LifecycleStage } from "@/lib/contacts/types";

export type DripChannel = "sms" | "email";

export type DripStep = {
  /** Zero-based index — matches the `current_step` column. */
  index: number;
  /** Days from the previous step's send. Step 0 fires `daysAfterPrevious`
   *  days after enrollment (so 0 = same day). */
  daysAfterPrevious: number;
  channel: DripChannel;
  /** Short label for UI / logs. Not user-facing copy. */
  label: string;
  /** Body template. Placeholders:
   *    {{firstName}}        — contact first name (or "there")
   *    {{agentFirstName}}   — agent first name
   *    {{propertyAddress}}  — past closing address (may be empty)
   * Email steps may also reference a {{equityHook}} or {{marketHook}}
   * placeholder; the processor decides whether to inject them. */
  body: string;
  /** Optional subject for email steps. */
  subject?: string;
};

export type DripCadence = {
  key: string;
  /** Total step count. Convenience — equals steps.length. */
  totalSteps: number;
  steps: ReadonlyArray<DripStep>;
};

/**
 * V1 cadence for the both_high cohort. 6 touches over ~30 days, alternating
 * SMS and email. SMS leads (highest open rate, sets the relationship to
 * "we're texting" rather than "we're emailing"), email follows for the
 * value-add / market context.
 */
export const BOTH_HIGH_CADENCE_KEY = "both_high_v1";

export const BOTH_HIGH_CADENCE: DripCadence = {
  key: BOTH_HIGH_CADENCE_KEY,
  totalSteps: 6,
  steps: [
    {
      index: 0,
      daysAfterPrevious: 0,
      channel: "sms",
      label: "Day 0 — opener",
      body:
        "Hey {{firstName}}! It's {{agentFirstName}}. I was thinking about you — wanted to check in and see how things are with the home. Anything on the horizon you're considering? No rush, just keeping in touch.",
    },
    {
      index: 1,
      daysAfterPrevious: 3,
      channel: "email",
      label: "Day 3 — equity update",
      subject: "Your home value update — quick read",
      body:
        "Hi {{firstName}},\n\nQuick check-in with a refreshed value estimate on {{propertyAddress}}. The neighborhood has moved enough lately that it felt worth flagging — happy to break down what's behind the number if useful.\n\nLet me know if you'd like a fuller comp report.\n\n— {{agentFirstName}}",
    },
    {
      index: 2,
      daysAfterPrevious: 4,
      channel: "sms",
      label: "Day 7 — value-add tip",
      body:
        "{{firstName}} — small one for you: <fill in seasonal home tip>. (No pitch attached, just thought it might land for the season.) — {{agentFirstName}}",
    },
    {
      index: 3,
      daysAfterPrevious: 7,
      channel: "email",
      label: "Day 14 — neighborhood pulse",
      subject: "What's moving on your block",
      body:
        "Hi {{firstName}},\n\nQuick neighborhood pulse — three homes traded near {{propertyAddress}} in the last 30 days. Worth a 60-second read if you're tracking what equity looks like right now.\n\nReply if you want me to send the comps.\n\n— {{agentFirstName}}",
    },
    {
      index: 4,
      daysAfterPrevious: 7,
      channel: "sms",
      label: "Day 21 — direct ask",
      body:
        "Hey {{firstName}} — random ask: any chance you've been thinking about a move in the next 6-12 months? No pressure, just want to make sure you have what you need from me when the time comes. — {{agentFirstName}}",
    },
    {
      index: 5,
      daysAfterPrevious: 9,
      channel: "email",
      label: "Day 30 — recap + soft re-engagement",
      subject: "Closing the loop",
      body:
        "Hi {{firstName}},\n\nWanted to wrap the check-in series — if anything I sent landed (or didn't), I'd love to know. The door stays open whenever you're ready to talk about a next move, even if it's a year out.\n\nGrateful for your trust.\n\n— {{agentFirstName}}",
    },
  ],
};

/**
 * Lifecycle stages eligible for this cadence. Mirrors the sphere-prediction
 * cohort so we never enroll a hot lead — they're a separate funnel.
 */
export const DRIP_ELIGIBLE_LIFECYCLES: ReadonlyArray<LifecycleStage> = [
  "past_client",
  "sphere",
];

/**
 * Get the next step (after `currentStep` has been sent). Returns null when
 * the cadence is complete.
 *
 *   currentStep = 0  →  step at index 0 has NOT been sent yet → next is steps[0]
 *   currentStep = 1  →  step 0 sent, next is steps[1]
 *   currentStep = N  →  null (completed)
 *
 * The convention: `current_step` always points to the NEXT step to send.
 * Advancing means incrementing `current_step` AFTER a successful send.
 */
export function getStepAt(cadence: DripCadence, currentStep: number): DripStep | null {
  if (currentStep < 0) return null;
  if (currentStep >= cadence.totalSteps) return null;
  return cadence.steps[currentStep] ?? null;
}

/**
 * Compute the ISO timestamp the NEXT step is due, given the last-sent
 * timestamp and the step about to fire. Anchored on the previous step's
 * actual send so a slip on one step shifts the rest of the cadence
 * accordingly (vs. drifting back to a fixed enrollment-date schedule).
 *
 *   - For step 0 (no previous send): anchor on `enrolledAt`.
 *   - For step N: anchor on `lastSentAt`, add `daysAfterPrevious`.
 *
 * Returns null when the cadence is already complete (no next step).
 */
export function computeNextDueAt(
  cadence: DripCadence,
  currentStep: number,
  enrolledAt: string,
  lastSentAt: string | null,
): string | null {
  const step = getStepAt(cadence, currentStep);
  if (!step) return null;
  const anchorIso = currentStep === 0 ? enrolledAt : (lastSentAt ?? enrolledAt);
  const anchorMs = Date.parse(anchorIso);
  if (!Number.isFinite(anchorMs)) return null;
  const dueMs = anchorMs + step.daysAfterPrevious * 86_400_000;
  return new Date(dueMs).toISOString();
}

/**
 * Render a step's body with the contact + agent context. Pure string
 * substitution. Empty/missing fields collapse cleanly:
 *   - {{firstName}} → "there" when missing
 *   - {{agentFirstName}} → "your agent" when missing
 *   - {{propertyAddress}} → "the home" when missing
 */
export function renderStepBody(
  step: DripStep,
  ctx: {
    firstName: string | null;
    agentFirstName: string | null;
    propertyAddress: string | null;
  },
): string {
  const first = (ctx.firstName ?? "").trim() || "there";
  const agent = (ctx.agentFirstName ?? "").trim() || "your agent";
  const addr = (ctx.propertyAddress ?? "").trim() || "the home";
  return step.body
    .replaceAll("{{firstName}}", first)
    .replaceAll("{{agentFirstName}}", agent)
    .replaceAll("{{propertyAddress}}", addr);
}

/**
 * Same idea for the email subject. SMS steps have no subject and this is
 * a no-op for them.
 */
export function renderStepSubject(
  step: DripStep,
  ctx: {
    firstName: string | null;
    agentFirstName: string | null;
  },
): string | null {
  if (!step.subject) return null;
  const first = (ctx.firstName ?? "").trim() || "there";
  const agent = (ctx.agentFirstName ?? "").trim() || "your agent";
  return step.subject
    .replaceAll("{{firstName}}", first)
    .replaceAll("{{agentFirstName}}", agent);
}

/**
 * Total expected duration of the cadence in days, summed from the step
 * spacing. Useful for UI hints ("30-day nurture sequence").
 */
export function cadenceDurationDays(cadence: DripCadence): number {
  return cadence.steps.reduce((sum, s) => sum + s.daysAfterPrevious, 0);
}
