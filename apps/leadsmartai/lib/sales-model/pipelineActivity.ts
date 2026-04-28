/**
 * Per-stage activity counts for the sales-model pipeline view.
 *
 * Each model's pipeline is a string array (`Audience → DM Lead → …`).
 * The dashboard wants to show a single "X this week" / "X active" /
 * "X all-time" number under each stage card so the path-to-close
 * doesn't feel decorative — the numbers move every day.
 *
 * Design notes:
 *   - The mapping is hand-rolled per model id rather than enum-driven
 *     because each model's stage labels are model-specific (an
 *     Influencer's "Audience" doesn't fit a Closer's "Prospect" enum).
 *     The builder uses `model.id` to pick a stage→snapshot-key
 *     function and runs it left-to-right against the pipeline.
 *   - The snapshot input only contains pre-aggregated counts. No raw
 *     rows live in here — all DB work happens in the .server.ts
 *     companion. Keeping this pure means vitest hits it without
 *     Supabase.
 *   - Falling back to `null` (rather than 0) when the data isn't
 *     applicable lets the UI hide the line entirely instead of
 *     rendering a misleading zero.
 */

import type { SalesModel, SalesModelId } from "@/lib/sales-models";

export type ActivitySnapshot = {
  /** All non-archived contacts owned by this agent. */
  totalContacts: number;
  /** Contacts created in the last 7 days. */
  newContactsLast7d: number;
  /** lifecycle_stage='lead'. */
  leadCount: number;
  /** lifecycle_stage='active_client'. */
  activeClientCount: number;
  /** lifecycle_stage='past_client'. */
  pastClientCount: number;
  /** rating in {A, B} — high-priority leads. */
  hotContactCount: number;
  /** last_contacted_at within the last 7 days. */
  contactedLast7d: number;
  /** next_contact_at within the next 7 days (booked / planned). */
  upcomingTouchpoints: number;
  /** transactions.status='active'. */
  activeTransactionCount: number;
  /** transactions.status='closed' (lifetime). */
  closedTransactionCount: number;
};

export type StageActivity = {
  /** The number to render. Null means "no data applies for this stage" — UI omits the line. */
  count: number | null;
  /** Short suffix shown next to the number, e.g. "this week" or "active". */
  label: string;
};

/**
 * Build the per-stage activity array. Output length matches
 * `model.pipeline.length` — stage at index N ↔ activity at index N.
 */
export function buildPipelineActivity(
  model: SalesModel,
  snapshot: ActivitySnapshot,
): StageActivity[] {
  const fn = STAGE_FNS[model.id];
  return model.pipeline.map((_, idx) => fn(idx, snapshot, model.pipeline.length));
}

type StageFn = (
  idx: number,
  s: ActivitySnapshot,
  total: number,
) => StageActivity;

/** Last stage in any model is always "Closed" or its synonym. */
function closedStage(s: ActivitySnapshot): StageActivity {
  return { count: s.closedTransactionCount, label: "all-time" };
}

/** Second-to-last is always "Agreement" / "Client" (active deals). */
function activeDealStage(s: ActivitySnapshot): StageActivity {
  return { count: s.activeTransactionCount, label: "active" };
}

const STAGE_FNS: Record<SalesModelId, StageFn> = {
  // ── Influencer: Audience → DM Lead → Qualified → Consultation → Client → Closed
  influencer: (idx, s, total) => {
    if (idx === total - 1) return closedStage(s);
    if (idx === total - 2) return activeDealStage(s);
    switch (idx) {
      case 0: return { count: s.totalContacts, label: "all-time" };
      case 1: return { count: s.newContactsLast7d, label: "this week" };
      case 2: return { count: s.hotContactCount, label: "warm+" };
      case 3: return { count: s.upcomingTouchpoints, label: "next 7d" };
      default: return { count: null, label: "" };
    }
  },

  // ── Closer: Prospect → Contacted → Qualified → Appointment → Agreement → Closed
  closer: (idx, s, total) => {
    if (idx === total - 1) return closedStage(s);
    if (idx === total - 2) return activeDealStage(s);
    switch (idx) {
      case 0: return { count: s.leadCount, label: "open" };
      case 1: return { count: s.contactedLast7d, label: "this week" };
      case 2: return { count: s.hotContactCount, label: "warm+" };
      case 3: return { count: s.upcomingTouchpoints, label: "next 7d" };
      default: return { count: null, label: "" };
    }
  },

  // ── Advisor: Lead → Discovery → Analysis → Strategy → Decision → Agreement → Closed
  advisor: (idx, s, total) => {
    if (idx === total - 1) return closedStage(s);
    if (idx === total - 2) return activeDealStage(s);
    switch (idx) {
      case 0: return { count: s.leadCount, label: "open" };
      case 1: return { count: s.contactedLast7d, label: "this week" };
      case 2: return { count: s.hotContactCount, label: "warm+" };
      case 3: return { count: s.upcomingTouchpoints, label: "next 7d" };
      case 4: return { count: s.activeClientCount, label: "active" };
      default: return { count: null, label: "" };
    }
  },

  // ── Custom: Lead → Contacted → Qualified → Negotiation → Closed
  custom: (idx, s, total) => {
    if (idx === total - 1) return closedStage(s);
    if (idx === total - 2) return activeDealStage(s);
    switch (idx) {
      case 0: return { count: s.leadCount, label: "open" };
      case 1: return { count: s.contactedLast7d, label: "this week" };
      case 2: return { count: s.hotContactCount, label: "warm+" };
      default: return { count: null, label: "" };
    }
  },
};

/** Empty snapshot — useful for tests and as a fallback when the data
 *  fetch fails. Renders zeros across the board rather than blowing up. */
export const EMPTY_ACTIVITY_SNAPSHOT: ActivitySnapshot = {
  totalContacts: 0,
  newContactsLast7d: 0,
  leadCount: 0,
  activeClientCount: 0,
  pastClientCount: 0,
  hotContactCount: 0,
  contactedLast7d: 0,
  upcomingTouchpoints: 0,
  activeTransactionCount: 0,
  closedTransactionCount: 0,
};
