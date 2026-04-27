import type {
  DealCoachAction,
  DealCoachActionInput,
  DealCoachActionPlan,
  DealCoachActionPriority,
} from "@/lib/dealCoach/types";

/**
 * Pure prioritized-action builder for the AI Deal Coach.
 *
 * Inputs: deal stage + risk pillars + timing signals.
 * Output: a sorted list of "do this now" actions per the agent's stage.
 *
 * Priority sort:
 *   1. high before medium before low
 *   2. within a priority, the order they were emitted (which matches
 *      stage-dictated logical order — e.g. "validate price" before
 *      "draft cover letter" in the drafting stage)
 *
 * Stages have curated baseline actions; risk pillars and timing signals
 * insert additional actions on top. No ML, no surprises — every action
 * has a rationale string the agent can read.
 */

const PRIORITY_ORDER: Record<DealCoachActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function action(
  id: string,
  priority: DealCoachActionPriority,
  title: string,
  rationale: string,
  estimatedMinutes: number,
): DealCoachAction {
  return { id, priority, title, rationale, estimatedMinutes };
}

/**
 * Stage baselines: actions an agent should always have on the radar at a
 * given stage, even before risks / timing kick in. These bias toward
 * concrete next-steps over generic "review the deal" language.
 */
function stageBaseline(input: DealCoachActionInput): DealCoachAction[] {
  switch (input.stage) {
    case "drafting":
      return [
        action(
          "validate_price",
          "high",
          "Confirm offer price against latest comps",
          "Price drives every downstream risk — anchor the offer to closed comparables before sending.",
          15,
        ),
        action(
          "draft_cover_letter",
          "medium",
          "Draft the buyer's cover letter",
          "Sellers in a multi-offer market remember the personal note even when economics tie.",
          20,
        ),
        action(
          "verify_proof_of_funds",
          "medium",
          "Confirm proof of funds / pre-approval is current",
          "Stale POF is the #1 reason listing agents soft-reject otherwise-strong offers.",
          10,
        ),
      ];

    case "sent":
      return [
        action(
          "monitor_response",
          "low",
          "Monitor for seller response",
          "No action required yet — the seller has the ball. The follow-up nudges fire automatically as time passes.",
          0,
        ),
      ];

    case "countered":
      return [
        action(
          "respond_to_counter",
          "high",
          "Respond to seller counter",
          "Counters cool fast — silence past 24h is read as 'maybe not serious'. Use the negotiation script below to draft your response.",
          25,
        ),
        action(
          "review_terms_changed",
          "high",
          "Review every term the seller changed",
          "Sellers sometimes counter on price + slip in non-price terms (closing date, contingencies). Diff the documents line-by-line.",
          15,
        ),
      ];

    case "accepted":
      return [
        action(
          "schedule_inspection",
          "high",
          "Schedule inspection within the contingency window",
          "Inspection windows are short (typically 7–10 days). Lock the appointment today so you have time to negotiate repairs.",
          15,
        ),
        action(
          "lock_financing",
          "high",
          "Confirm rate lock + appraisal order with the lender",
          "Rates move daily — a missed lock can change the deal economics by tens of thousands.",
          10,
        ),
        action(
          "send_executed_to_title",
          "medium",
          "Forward executed contract to title / escrow",
          "Earlier the title company has it, earlier they can clear the file — protects against last-minute lien surprises.",
          5,
        ),
      ];

    case "rejected":
      return [
        action(
          "review_rejection_reason",
          "high",
          "Capture why the offer was rejected",
          "If price-only, you may revisit when the listing ages. If terms-based, the lesson applies to the next offer too.",
          10,
        ),
        action(
          "queue_relisting_alert",
          "medium",
          "Queue a price-drop / relisting alert on this property",
          "Rejected offers from 30–90d ago are often re-engaged successfully when price drops or market cools.",
          5,
        ),
      ];

    default:
      return [];
  }
}

/**
 * Risk-driven actions. Triggered by the risk pillars from `lib/risk.ts`.
 * Stacking is intentional: a deal with high overpay AND high appraisal
 * gets BOTH actions, not one merged warning — they need different fixes.
 */
function riskActions(input: DealCoachActionInput): DealCoachAction[] {
  const out: DealCoachAction[] = [];
  const r = input.risks;
  if (!r) return out;

  if (r.overpay.level === "high") {
    out.push(
      action(
        "reassess_overpay",
        "high",
        "Re-evaluate price before sending — overpay risk is high",
        r.overpay.notes ||
          "Offer is materially above the comp anchor. Either tighten the comp set or accept the overpay risk knowingly.",
        20,
      ),
    );
  } else if (r.overpay.level === "medium") {
    out.push(
      action(
        "monitor_overpay",
        "medium",
        "Pre-mortem: what if the appraisal comes in 3% under?",
        "Medium overpay risk means the deal still works but margin is thin — confirm the buyer can cover the gap.",
        10,
      ),
    );
  }

  if (r.appraisal.level === "high") {
    out.push(
      action(
        "appraisal_contingency_plan",
        "high",
        "Plan for a low appraisal — gap-coverage clause or escalation cap",
        r.appraisal.notes ||
          "Appraisal risk is high. Decide before sending: gap-coverage cap, lower offer, or walk-away threshold.",
        15,
      ),
    );
  }

  if (r.market.level === "high") {
    out.push(
      action(
        "market_pressure_strategy",
        "medium",
        "Account for hot-market pressure tactics",
        r.market.notes ||
          "Market heat increases the chance the seller fields multiple offers. Use non-price levers (closing speed, clean terms) to stand out.",
        10,
      ),
    );
  }

  return out;
}

/**
 * Timing-driven actions. The follow-up cadence here is deliberate:
 *
 *   - 24h post-send → soft nudge ("monitor only — too early to push")
 *   - 48h post-send → suggested polite follow-up
 *   - 72h+ post-send → strong follow-up (or the deal is silently dying)
 *
 * Same logic for stage='countered': agents lose deals here by being slow
 * to respond.
 */
function timingActions(input: DealCoachActionInput): DealCoachAction[] {
  const out: DealCoachAction[] = [];
  const sinceAct = input.hoursSinceLastAgentAction;

  if (input.stage === "sent" && typeof sinceAct === "number") {
    if (sinceAct >= 72) {
      out.push(
        action(
          "strong_followup_sent",
          "high",
          "Send a 'just checking in' to the listing agent",
          `Offer has been outstanding ~${Math.round(sinceAct)}h. Most accepted offers get a response inside 48h — silence past 72h usually means it's drifting.`,
          5,
        ),
      );
    } else if (sinceAct >= 48) {
      out.push(
        action(
          "polite_followup_sent",
          "medium",
          "Send a brief follow-up to the listing agent",
          `Offer outstanding ~${Math.round(sinceAct)}h. A short polite nudge keeps you front-of-mind without applying pressure.`,
          5,
        ),
      );
    }
  }

  if (input.stage === "countered" && typeof sinceAct === "number" && sinceAct >= 12) {
    out.push(
      action(
        "respond_counter_urgent",
        "high",
        "Respond to the counter — timing is critical",
        `Counter has been outstanding ~${Math.round(sinceAct)}h. Sellers read silence as soft-pass; respond today with at least an acknowledgment.`,
        20,
      ),
    );
  }

  return out;
}

/**
 * Competition / budget signals.
 */
function competitionActions(input: DealCoachActionInput): DealCoachAction[] {
  const out: DealCoachAction[] = [];

  if (input.competingOfferCount != null && input.competingOfferCount >= 2 && input.stage === "drafting") {
    out.push(
      action(
        "differentiate_in_multioffer",
        "high",
        "Differentiate beyond price — non-price levers",
        `${input.competingOfferCount} competing offers reported. Lead with reliability (clean financing, flexible closing, fewer contingencies) before reaching for escalation clauses.`,
        15,
      ),
    );
  }

  if (input.budgetTight) {
    out.push(
      action(
        "budget_walkaway_threshold",
        "medium",
        "Pre-set a walk-away threshold",
        "Buyer is near their hard ceiling. Decide the walk-away number with them BEFORE the seller counters — emotional decisions in the moment over-pay.",
        10,
      ),
    );
  }

  return out;
}

export function buildDealCoachActionPlan(
  input: DealCoachActionInput,
): DealCoachActionPlan {
  const collected: DealCoachAction[] = [
    ...stageBaseline(input),
    ...riskActions(input),
    ...timingActions(input),
    ...competitionActions(input),
  ];

  // Stable sort by priority. Within a priority, preserve insertion order
  // (which is stage → risks → timing → competition — most "do first" early).
  const indexed = collected.map((a, i) => ({ a, i }));
  indexed.sort((x, y) => {
    const p = PRIORITY_ORDER[x.a.priority] - PRIORITY_ORDER[y.a.priority];
    if (p !== 0) return p;
    return x.i - y.i;
  });

  return { actions: indexed.map((x) => x.a) };
}

/**
 * Headline copy for the report. Pure helper exported so the service +
 * tests can lock down the wording.
 */
export function buildHeadline(input: DealCoachActionInput): string {
  const stageLabel: Record<DealCoachActionInput["stage"], string> = {
    drafting: "Drafting the offer",
    sent: "Offer sent — waiting on the seller",
    countered: "Seller countered — your move",
    accepted: "Under contract",
    rejected: "Offer rejected",
  };

  const r = input.risks;
  const highRisks: string[] = [];
  if (r?.overpay.level === "high") highRisks.push("overpay");
  if (r?.appraisal.level === "high") highRisks.push("appraisal");
  if (r?.market.level === "high") highRisks.push("market");

  const base = stageLabel[input.stage] ?? "Active deal";
  if (highRisks.length === 0) return base + ".";
  return `${base}. High risk: ${highRisks.join(", ")}.`;
}
