/**
 * California buyer-rep closing-phase seed checklist.
 *
 * Every row in this array becomes a `transaction_tasks` row on
 * transaction create (see `createTransaction` in ./service.ts).
 *
 * Conventions:
 *   * `seed_key` is stable forever. Agents may rely on it (notes,
 *     scripts, future search). Never repurpose an existing key —
 *     if the meaning changes, retire the old key and add a new one.
 *   * `offset_from_mutual_acceptance_days` drives default `due_date`
 *     population. Null means "no auto-due-date; agent sets it."
 *   * `stage` keys match the DB CHECK constraint and the visible
 *     stage headers on the detail page.
 *   * Task titles are deliberately short + action-oriented — the
 *     detail-page UI shows them in a one-line row.
 *
 * Source: combination of CAR (California Assoc. of Realtors) standard
 * timelines + buyer-rep ops checklist widely used in CA brokerages.
 * The specific day counts follow the CA RPA default contingency
 * periods (17 days for inspection, 17 for appraisal if separate, 21
 * for loan) but can be adjusted per deal via the transaction record.
 *
 * Listing-side support:
 *   This file is buyer-rep only. When we add listing_rep support,
 *   add a parallel `LISTING_REP_SEED_TASKS` array and branch in
 *   `seedTasksFor()`. Keeping them as separate constant arrays (vs
 *   one flag-filtered list) is clearer — the two checklists don't
 *   overlap more than superficially.
 */

import type { TransactionStage, TransactionType } from "./types";

export type SeedTask = {
  /** Stable identifier; never repurpose. Referenced by DB unique index. */
  seedKey: string;
  stage: TransactionStage;
  title: string;
  description?: string;
  /**
   * Days after `mutual_acceptance_date` this task is due. NULL means
   * the agent sets the due date (or there isn't a crisp deadline —
   * e.g. "establish timeline with client" is about setting expectations,
   * not hitting a date).
   */
  offsetFromMutualAcceptanceDays: number | null;
};

const BUYER_REP_SEED_TASKS: SeedTask[] = [
  // ── Contract stage (day 0-2, anchor = mutual acceptance) ──
  {
    seedKey: "open_escrow",
    stage: "contract",
    title: "Open escrow with title company",
    description:
      "Send ratified contract to title. Confirm escrow officer assigned + escrow number issued.",
    offsetFromMutualAcceptanceDays: 1,
  },
  {
    seedKey: "deliver_emd",
    stage: "contract",
    title: "Deliver earnest money deposit",
    description:
      "Coordinate with buyer — deposit due within 3 business days by CA RPA default. Confirm escrow has received it.",
    offsetFromMutualAcceptanceDays: 3,
  },
  {
    seedKey: "order_nhd",
    stage: "contract",
    title: "Order Natural Hazard Disclosure (NHD) report",
    description:
      "California-required disclosure. Typically ordered through title or a standalone NHD service.",
    offsetFromMutualAcceptanceDays: 2,
  },
  {
    seedKey: "order_prelim_title",
    stage: "contract",
    title: "Order preliminary title report",
    description:
      "Review for liens, easements, encumbrances. Flag anything unusual for the buyer before inspection contingency expires.",
    offsetFromMutualAcceptanceDays: 3,
  },
  {
    seedKey: "review_tds_spq",
    stage: "contract",
    title: "Review seller disclosures (TDS, SPQ) with buyer",
    description:
      "Transfer Disclosure Statement + Seller Property Questionnaire. Delivered by seller within 7 days; buyer has 3 days to object after receipt.",
    offsetFromMutualAcceptanceDays: 7,
  },
  {
    seedKey: "review_hoa_docs",
    stage: "contract",
    title: "Review HOA docs with buyer (if applicable)",
    description:
      "CC&Rs, bylaws, budget, reserve study, pending litigation, meeting minutes. If not an HOA property, mark complete.",
    offsetFromMutualAcceptanceDays: 14,
  },
  {
    seedKey: "confirm_loan_application",
    stage: "contract",
    title: "Confirm loan application started with lender",
    description:
      "Buyer should have submitted full app within 7 days. Verify with lender, not just the buyer's word.",
    offsetFromMutualAcceptanceDays: 7,
  },
  {
    seedKey: "timeline_walkthrough",
    stage: "contract",
    title: "Walk buyer through the full timeline",
    description:
      "Every contingency date + what they need to do at each. Managing expectations now prevents late-stage surprises.",
    offsetFromMutualAcceptanceDays: null,
  },

  // ── Inspection stage (day 0-17) ──
  {
    seedKey: "schedule_general_inspection",
    stage: "inspection",
    title: "Schedule general home inspection",
    description:
      "Book within first 5-7 days so repair negotiations fit in the contingency window.",
    offsetFromMutualAcceptanceDays: 7,
  },
  {
    seedKey: "schedule_specialist_inspections",
    stage: "inspection",
    title: "Schedule specialist inspections",
    description:
      "Roof, chimney, sewer lateral, pool/spa, pest (termite), foundation — based on general inspector's flags or property age.",
    offsetFromMutualAcceptanceDays: 10,
  },
  {
    seedKey: "review_inspection_reports",
    stage: "inspection",
    title: "Review inspection reports with buyer",
    description:
      "Separate critical structural issues from cosmetic. Frame the repair-request conversation realistically.",
    offsetFromMutualAcceptanceDays: 12,
  },
  {
    seedKey: "submit_repair_request",
    stage: "inspection",
    title: "Submit Request for Repairs (RR) to listing agent",
    description:
      "Use the CAR RR form. Be specific — 'repair per licensed contractor' beats 'make it work.' Negotiations can extend contingency by mutual written agreement if needed.",
    offsetFromMutualAcceptanceDays: 14,
  },
  {
    seedKey: "remove_inspection_contingency",
    stage: "inspection",
    title: "Remove inspection contingency (or cancel)",
    description:
      "Day 17 under CA RPA default. If seller hasn't responded to RR, EXTEND in writing — do not let the clock run out without a plan.",
    offsetFromMutualAcceptanceDays: 17,
  },

  // ── Appraisal stage (day 5-17) ──
  {
    seedKey: "coordinate_appraisal_access",
    stage: "appraisal",
    title: "Coordinate appraiser access to property",
    description:
      "Lender orders the appraiser; you coordinate timing with listing agent. Aim to complete before day 17.",
    offsetFromMutualAcceptanceDays: 14,
  },
  {
    seedKey: "review_appraisal_report",
    stage: "appraisal",
    title: "Review appraisal report",
    description:
      "Appraised value vs contract price. If low, you have leverage to renegotiate OR buyer must cover the gap in cash.",
    offsetFromMutualAcceptanceDays: 16,
  },
  {
    seedKey: "remove_appraisal_contingency",
    stage: "appraisal",
    title: "Remove appraisal contingency",
    description:
      "Day 17 under CA RPA default. Only remove if appraisal is at or above contract price, OR buyer has agreed in writing to cover any gap.",
    offsetFromMutualAcceptanceDays: 17,
  },

  // ── Loan stage (day 15-21) ──
  {
    seedKey: "verify_underwriter_docs",
    stage: "loan",
    title: "Verify lender has all underwriting docs",
    description:
      "Check in with lender directly — 'buyer says we're good' is not enough. Confirm nothing is outstanding.",
    offsetFromMutualAcceptanceDays: 18,
  },
  {
    seedKey: "confirm_clear_to_close",
    stage: "loan",
    title: "Confirm clear-to-close from lender",
    description:
      "This is the real milestone. Buyer's loan contingency removes based on this, not on lender optimism earlier in the week.",
    offsetFromMutualAcceptanceDays: 21,
  },
  {
    seedKey: "remove_loan_contingency",
    stage: "loan",
    title: "Remove loan contingency",
    description:
      "Day 21 CA RPA default. Only remove AFTER clear-to-close, not before. If loan isn't there yet, extend in writing.",
    offsetFromMutualAcceptanceDays: 21,
  },

  // ── Closing stage (day 21-30) ──
  {
    seedKey: "review_closing_disclosure",
    stage: "closing",
    title: "Review Closing Disclosure (CD) with buyer",
    description:
      "Buyer must receive CD at least 3 business days before signing (TRID). Walk through it line-by-line — closing costs, loan terms, escrow breakdown.",
    offsetFromMutualAcceptanceDays: 25,
  },
  {
    seedKey: "verify_wire_instructions",
    stage: "closing",
    title: "⚠️ Verbally verify wire instructions with title",
    description:
      "CRITICAL: call the title company on a KNOWN phone number (not the one in the email). Wire fraud is the #1 closing-phase risk — fraudsters impersonate title companies and redirect funds. Never rely solely on emailed instructions.",
    offsetFromMutualAcceptanceDays: 26,
  },
  {
    seedKey: "confirm_homeowners_insurance",
    stage: "closing",
    title: "Confirm homeowner's insurance in force",
    description:
      "Policy must be bound and paid for day 1. Lender needs proof; escrow can't fund without it.",
    offsetFromMutualAcceptanceDays: 27,
  },
  {
    seedKey: "schedule_final_walkthrough",
    stage: "closing",
    title: "Schedule final walkthrough",
    description:
      "Typically 24-48 hours before close. Confirm property in agreed condition, all negotiated repairs done, no new damage.",
    offsetFromMutualAcceptanceDays: 28,
  },
  {
    seedKey: "buyer_sign_appointment",
    stage: "closing",
    title: "Confirm buyer signing appointment at title",
    description:
      "Or mobile notary if remote. Buyer brings government photo ID; wire should already be sent or cashier's check ready.",
    offsetFromMutualAcceptanceDays: 29,
  },
  {
    seedKey: "confirm_funding",
    stage: "closing",
    title: "Confirm funding from lender to title",
    description:
      "Lender funds title on or around closing day. No funding = no close = no keys.",
    offsetFromMutualAcceptanceDays: 30,
  },
  {
    seedKey: "confirm_recording",
    stage: "closing",
    title: "Confirm deed recorded at county",
    description:
      "Title records the deed with the county recorder. Until recorded, the buyer isn't legally the owner.",
    offsetFromMutualAcceptanceDays: 30,
  },
  {
    seedKey: "key_handoff",
    stage: "closing",
    title: "Coordinate key handoff with buyer",
    description:
      "Keys, garage remotes, mailbox keys, HOA fobs, appliance manuals, warranty paperwork. Often handed over at the signing or via lockbox after recording.",
    offsetFromMutualAcceptanceDays: 30,
  },
  {
    seedKey: "utility_transfer_reminder",
    stage: "closing",
    title: "Remind buyer to transfer utilities",
    description:
      "Electric, gas, water, trash, internet. Usually effective the close-of-escrow date. Easy to forget in the signing-day adrenaline.",
    offsetFromMutualAcceptanceDays: 29,
  },
];

export function seedTasksFor(type: TransactionType): SeedTask[] {
  // Only buyer_rep is seeded for MVP. Listing + dual return an empty
  // array — the agent manually adds tasks for those deals until the
  // listing-rep seed lands in a follow-up.
  if (type === "buyer_rep") return BUYER_REP_SEED_TASKS;
  return [];
}

export const BUYER_REP_TASK_COUNT = BUYER_REP_SEED_TASKS.length;
