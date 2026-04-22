/**
 * California seed checklists — buyer-rep and listing-rep.
 *
 * Every row becomes a `transaction_tasks` row on transaction create
 * (see `createTransaction` in ./service.ts).
 *
 * Conventions:
 *   * `seedKey` is stable forever. Agents may rely on it (notes, scripts,
 *     future search). Never repurpose an existing key — if the meaning
 *     changes, retire the old key and add a new one.
 *   * `anchor` chooses which date on the transaction drives the due_date
 *     offset. Buyer-rep always uses `mutual_acceptance`. Listing-rep
 *     tasks use `listing_start` for pre-list + marketing stages and
 *     `mutual_acceptance` for post-offer stages. If the relevant anchor
 *     is null on the transaction, due_date is null.
 *   * `offsetDays` null means "no auto-due-date; agent sets it."
 *   * `stage` keys match the DB CHECK constraint and the visible stage
 *     headers on the detail page.
 *   * Task titles are deliberately short + action-oriented — the detail
 *     page renders them in a one-line row.
 *
 * Source: combination of CAR (California Assoc. of Realtors) standard
 * timelines + buyer-rep and listing-rep ops checklists widely used in
 * CA brokerages. Day counts follow CA RPA/RLA default contingency
 * periods (17 days for inspection, 21 for loan, 30 for close) but can
 * be adjusted per deal via the transaction record.
 *
 * Dual agency:
 *   Treated as "no seed" for now. Dual-agency workflows touch both
 *   sides asymmetrically and a single seed array would be misleading.
 *   Agents add tasks manually until a dedicated dual template lands.
 */

import type { TransactionStage, TransactionType } from "./types";

export type SeedTaskAnchor = "mutual_acceptance" | "listing_start";

export type SeedTask = {
  /** Stable identifier; never repurpose. Referenced by DB unique index. */
  seedKey: string;
  stage: TransactionStage;
  title: string;
  description?: string;
  /** Which transaction date drives the due_date offset. */
  anchor: SeedTaskAnchor;
  /** Days after the anchor this task is due. Null → agent sets it. */
  offsetDays: number | null;
};

const BUYER_REP_SEED_TASKS: SeedTask[] = [
  // ── Contract stage (day 0-2, anchor = mutual acceptance) ──
  {
    seedKey: "open_escrow",
    stage: "contract",
    title: "Open escrow with title company",
    description:
      "Send ratified contract to title. Confirm escrow officer assigned + escrow number issued.",
    anchor: "mutual_acceptance",
    offsetDays: 1,
  },
  {
    seedKey: "deliver_emd",
    stage: "contract",
    title: "Deliver earnest money deposit",
    description:
      "Coordinate with buyer — deposit due within 3 business days by CA RPA default. Confirm escrow has received it.",
    anchor: "mutual_acceptance",
    offsetDays: 3,
  },
  {
    seedKey: "order_nhd",
    stage: "contract",
    title: "Order Natural Hazard Disclosure (NHD) report",
    description:
      "California-required disclosure. Typically ordered through title or a standalone NHD service.",
    anchor: "mutual_acceptance",
    offsetDays: 2,
  },
  {
    seedKey: "order_prelim_title",
    stage: "contract",
    title: "Order preliminary title report",
    description:
      "Review for liens, easements, encumbrances. Flag anything unusual for the buyer before inspection contingency expires.",
    anchor: "mutual_acceptance",
    offsetDays: 3,
  },
  {
    seedKey: "review_tds_spq",
    stage: "contract",
    title: "Review seller disclosures (TDS, SPQ) with buyer",
    description:
      "Transfer Disclosure Statement + Seller Property Questionnaire. Delivered by seller within 7 days; buyer has 3 days to object after receipt.",
    anchor: "mutual_acceptance",
    offsetDays: 7,
  },
  {
    seedKey: "review_hoa_docs",
    stage: "contract",
    title: "Review HOA docs with buyer (if applicable)",
    description:
      "CC&Rs, bylaws, budget, reserve study, pending litigation, meeting minutes. If not an HOA property, mark complete.",
    anchor: "mutual_acceptance",
    offsetDays: 14,
  },
  {
    seedKey: "confirm_loan_application",
    stage: "contract",
    title: "Confirm loan application started with lender",
    description:
      "Buyer should have submitted full app within 7 days. Verify with lender, not just the buyer's word.",
    anchor: "mutual_acceptance",
    offsetDays: 7,
  },
  {
    seedKey: "timeline_walkthrough",
    stage: "contract",
    title: "Walk buyer through the full timeline",
    description:
      "Every contingency date + what they need to do at each. Managing expectations now prevents late-stage surprises.",
    anchor: "mutual_acceptance",
    offsetDays: null,
  },

  // ── Inspection stage (day 0-17) ──
  {
    seedKey: "schedule_general_inspection",
    stage: "inspection",
    title: "Schedule general home inspection",
    description:
      "Book within first 5-7 days so repair negotiations fit in the contingency window.",
    anchor: "mutual_acceptance",
    offsetDays: 7,
  },
  {
    seedKey: "schedule_specialist_inspections",
    stage: "inspection",
    title: "Schedule specialist inspections",
    description:
      "Roof, chimney, sewer lateral, pool/spa, pest (termite), foundation — based on general inspector's flags or property age.",
    anchor: "mutual_acceptance",
    offsetDays: 10,
  },
  {
    seedKey: "review_inspection_reports",
    stage: "inspection",
    title: "Review inspection reports with buyer",
    description:
      "Separate critical structural issues from cosmetic. Frame the repair-request conversation realistically.",
    anchor: "mutual_acceptance",
    offsetDays: 12,
  },
  {
    seedKey: "submit_repair_request",
    stage: "inspection",
    title: "Submit Request for Repairs (RR) to listing agent",
    description:
      "Use the CAR RR form. Be specific — 'repair per licensed contractor' beats 'make it work.' Negotiations can extend contingency by mutual written agreement if needed.",
    anchor: "mutual_acceptance",
    offsetDays: 14,
  },
  {
    seedKey: "remove_inspection_contingency",
    stage: "inspection",
    title: "Remove inspection contingency (or cancel)",
    description:
      "Day 17 under CA RPA default. If seller hasn't responded to RR, EXTEND in writing — do not let the clock run out without a plan.",
    anchor: "mutual_acceptance",
    offsetDays: 17,
  },

  // ── Appraisal stage (day 5-17) ──
  {
    seedKey: "coordinate_appraisal_access",
    stage: "appraisal",
    title: "Coordinate appraiser access to property",
    description:
      "Lender orders the appraiser; you coordinate timing with listing agent. Aim to complete before day 17.",
    anchor: "mutual_acceptance",
    offsetDays: 14,
  },
  {
    seedKey: "review_appraisal_report",
    stage: "appraisal",
    title: "Review appraisal report",
    description:
      "Appraised value vs contract price. If low, you have leverage to renegotiate OR buyer must cover the gap in cash.",
    anchor: "mutual_acceptance",
    offsetDays: 16,
  },
  {
    seedKey: "remove_appraisal_contingency",
    stage: "appraisal",
    title: "Remove appraisal contingency",
    description:
      "Day 17 under CA RPA default. Only remove if appraisal is at or above contract price, OR buyer has agreed in writing to cover any gap.",
    anchor: "mutual_acceptance",
    offsetDays: 17,
  },

  // ── Loan stage (day 15-21) ──
  {
    seedKey: "verify_underwriter_docs",
    stage: "loan",
    title: "Verify lender has all underwriting docs",
    description:
      "Check in with lender directly — 'buyer says we're good' is not enough. Confirm nothing is outstanding.",
    anchor: "mutual_acceptance",
    offsetDays: 18,
  },
  {
    seedKey: "confirm_clear_to_close",
    stage: "loan",
    title: "Confirm clear-to-close from lender",
    description:
      "This is the real milestone. Buyer's loan contingency removes based on this, not on lender optimism earlier in the week.",
    anchor: "mutual_acceptance",
    offsetDays: 21,
  },
  {
    seedKey: "remove_loan_contingency",
    stage: "loan",
    title: "Remove loan contingency",
    description:
      "Day 21 CA RPA default. Only remove AFTER clear-to-close, not before. If loan isn't there yet, extend in writing.",
    anchor: "mutual_acceptance",
    offsetDays: 21,
  },

  // ── Closing stage (day 21-30) ──
  {
    seedKey: "review_closing_disclosure",
    stage: "closing",
    title: "Review Closing Disclosure (CD) with buyer",
    description:
      "Buyer must receive CD at least 3 business days before signing (TRID). Walk through it line-by-line — closing costs, loan terms, escrow breakdown.",
    anchor: "mutual_acceptance",
    offsetDays: 25,
  },
  {
    seedKey: "verify_wire_instructions",
    stage: "closing",
    title: "⚠️ Verbally verify wire instructions with title",
    description:
      "CRITICAL: call the title company on a KNOWN phone number (not the one in the email). Wire fraud is the #1 closing-phase risk — fraudsters impersonate title companies and redirect funds. Never rely solely on emailed instructions.",
    anchor: "mutual_acceptance",
    offsetDays: 26,
  },
  {
    seedKey: "confirm_homeowners_insurance",
    stage: "closing",
    title: "Confirm homeowner's insurance in force",
    description:
      "Policy must be bound and paid for day 1. Lender needs proof; escrow can't fund without it.",
    anchor: "mutual_acceptance",
    offsetDays: 27,
  },
  {
    seedKey: "schedule_final_walkthrough",
    stage: "closing",
    title: "Schedule final walkthrough",
    description:
      "Typically 24-48 hours before close. Confirm property in agreed condition, all negotiated repairs done, no new damage.",
    anchor: "mutual_acceptance",
    offsetDays: 28,
  },
  {
    seedKey: "buyer_sign_appointment",
    stage: "closing",
    title: "Confirm buyer signing appointment at title",
    description:
      "Or mobile notary if remote. Buyer brings government photo ID; wire should already be sent or cashier's check ready.",
    anchor: "mutual_acceptance",
    offsetDays: 29,
  },
  {
    seedKey: "confirm_funding",
    stage: "closing",
    title: "Confirm funding from lender to title",
    description:
      "Lender funds title on or around closing day. No funding = no close = no keys.",
    anchor: "mutual_acceptance",
    offsetDays: 30,
  },
  {
    seedKey: "confirm_recording",
    stage: "closing",
    title: "Confirm deed recorded at county",
    description:
      "Title records the deed with the county recorder. Until recorded, the buyer isn't legally the owner.",
    anchor: "mutual_acceptance",
    offsetDays: 30,
  },
  {
    seedKey: "key_handoff",
    stage: "closing",
    title: "Coordinate key handoff with buyer",
    description:
      "Keys, garage remotes, mailbox keys, HOA fobs, appliance manuals, warranty paperwork. Often handed over at the signing or via lockbox after recording.",
    anchor: "mutual_acceptance",
    offsetDays: 30,
  },
  {
    seedKey: "utility_transfer_reminder",
    stage: "closing",
    title: "Remind buyer to transfer utilities",
    description:
      "Electric, gas, water, trash, internet. Usually effective the close-of-escrow date. Easy to forget in the signing-day adrenaline.",
    anchor: "mutual_acceptance",
    offsetDays: 29,
  },
];

const LISTING_REP_SEED_TASKS: SeedTask[] = [
  // ── Pre-list stage (anchor = listing_start, day 0-7) ──
  {
    seedKey: "rla_signed_review",
    stage: "contract",
    title: "Review signed RLA with seller",
    description:
      "Walk through Residential Listing Agreement terms — commission, listing period, agent duties, exclusions. Confirm seller understands what they signed.",
    anchor: "listing_start",
    offsetDays: 0,
  },
  {
    seedKey: "pricing_strategy",
    stage: "contract",
    title: "Finalize pricing strategy",
    description:
      "CMA-backed list price. Document the rationale — pricing above/below comps, price reduction triggers, competitive position. Shared expectation with seller prevents later conflict.",
    anchor: "listing_start",
    offsetDays: 1,
  },
  {
    seedKey: "order_photos",
    stage: "contract",
    title: "Schedule professional photography + video",
    description:
      "Book for a day with good natural light. Include drone exteriors for distinctive properties. No stock photos — MLS rejects them and buyers spot them instantly.",
    anchor: "listing_start",
    offsetDays: 2,
  },
  {
    seedKey: "staging_consult",
    stage: "contract",
    title: "Staging consultation with seller",
    description:
      "Decluttering, furniture staging, paint/repair recommendations. Vacant homes almost always benefit from furniture rental — vacant = hard to picture living there.",
    anchor: "listing_start",
    offsetDays: 2,
  },
  {
    seedKey: "prepare_seller_disclosures",
    stage: "contract",
    title: "Prepare seller disclosures (TDS, SPQ, NHD)",
    description:
      "Transfer Disclosure Statement, Seller Property Questionnaire, Natural Hazard Disclosure. Better to identify issues BEFORE listing than to surface them post-contract.",
    anchor: "listing_start",
    offsetDays: 3,
  },
  {
    seedKey: "mls_remarks",
    stage: "contract",
    title: "Draft MLS remarks + marketing copy",
    description:
      "Public + agent remarks. Lead with signature feature, not square footage. Describe the experience of living there, not just the floor plan.",
    anchor: "listing_start",
    offsetDays: 4,
  },
  {
    seedKey: "install_lockbox_sign",
    stage: "contract",
    title: "Install lockbox + for-sale sign",
    description:
      "Confirm HOA permits signage if applicable. Lockbox access code rotated + logged. Sign should be installed day-of-MLS-go-live for coordinated showings.",
    anchor: "listing_start",
    offsetDays: 5,
  },
  {
    seedKey: "mls_go_live",
    stage: "contract",
    title: "Go live on MLS",
    description:
      "Confirm listing appears on MLS, Zillow, Realtor.com, Redfin. Check photos render correctly on mobile. Status = 'Active' — not 'Coming Soon' at this point unless that's the strategy.",
    anchor: "listing_start",
    offsetDays: 7,
  },
  {
    seedKey: "syndication_check",
    stage: "contract",
    title: "Verify listing syndication + portal accuracy",
    description:
      "Details match across MLS, Zillow, Realtor.com, brokerage website. Incorrect square footage or bedroom count on a single portal can tank buyer trust.",
    anchor: "listing_start",
    offsetDays: 8,
  },
  {
    seedKey: "schedule_broker_preview",
    stage: "contract",
    title: "Schedule broker preview / caravan",
    description:
      "Get buyer agents through the door in the first week. Their feedback is your early signal for pricing + staging adjustments.",
    anchor: "listing_start",
    offsetDays: 8,
  },
  {
    seedKey: "first_open_house",
    stage: "contract",
    title: "Host first open house",
    description:
      "First weekend after MLS live. Capture every visitor's contact info — they're tomorrow's showings even if not today's offers.",
    anchor: "listing_start",
    offsetDays: 10,
  },

  // ── Active marketing (anchor = listing_start, day 10-30+) ──
  {
    seedKey: "first_feedback_review",
    stage: "inspection",
    title: "Review showing feedback with seller",
    description:
      "After first 5-10 showings. Common objections = tell you what to fix before the next 10. Price objections after week 1-2 = evidence the list price is off.",
    anchor: "listing_start",
    offsetDays: 14,
  },
  {
    seedKey: "pricing_review_week3",
    stage: "inspection",
    title: "Price/strategy review (week 3)",
    description:
      "If no offers by day 21, something is off — price, condition, or marketing. Present the seller with comps + showing count + feedback; align on adjustment or hold strategy.",
    anchor: "listing_start",
    offsetDays: 21,
  },
  {
    seedKey: "refresh_photos_if_stale",
    stage: "inspection",
    title: "Refresh MLS photos / remarks if listing stalls",
    description:
      "If no offers by day 30. Reshoot key images, adjust remarks, consider twilight photos. A re-promoted listing often gets new eyeballs treating it as fresh.",
    anchor: "listing_start",
    offsetDays: 30,
  },

  // ── Offer received (anchor = mutual_acceptance) ──
  {
    seedKey: "listing_deliver_ratified",
    stage: "contract",
    title: "Deliver ratified contract to seller + escrow",
    description:
      "Include all counters + addenda. Confirm seller has a copy for their records — they'll forget what they signed by escrow close.",
    anchor: "mutual_acceptance",
    offsetDays: 0,
  },
  {
    seedKey: "listing_verify_emd",
    stage: "contract",
    title: "Verify EMD received by escrow",
    description:
      "Within 3 business days by CA RPA default. Confirm escrow received it on time — this is a real contingency, not a formality.",
    anchor: "mutual_acceptance",
    offsetDays: 3,
  },
  {
    seedKey: "listing_confirm_buyer_preapproval",
    stage: "contract",
    title: "Confirm buyer lender pre-approval letter on file",
    description:
      "Call the lender directly. 'Pre-qualification' ≠ 'pre-approval'. Pre-qualification is self-reported income; pre-approval means docs have been verified.",
    anchor: "mutual_acceptance",
    offsetDays: 2,
  },
  {
    seedKey: "listing_deliver_disclosures",
    stage: "contract",
    title: "Deliver seller disclosures to buyer",
    description:
      "TDS, SPQ, NHD, HOA docs. Due within 7 days under CA RPA default. Missing this starts buyer's objection clock late.",
    anchor: "mutual_acceptance",
    offsetDays: 7,
  },

  // ── Inspection response (anchor = mutual_acceptance) ──
  {
    seedKey: "listing_review_repair_request",
    stage: "inspection",
    title: "Review buyer's Request for Repairs with seller",
    description:
      "Sort into 'reasonable / negotiable / no'. Frame the negotiation: credit-in-lieu often beats line-item repairs because it simplifies verification.",
    anchor: "mutual_acceptance",
    offsetDays: 14,
  },
  {
    seedKey: "listing_negotiate_repair_response",
    stage: "inspection",
    title: "Negotiate repair response (RRRR)",
    description:
      "Respond before buyer's 17-day inspection contingency. Silence = buyer extends or cancels. Put the response in writing and track receipt.",
    anchor: "mutual_acceptance",
    offsetDays: 16,
  },
  {
    seedKey: "listing_confirm_contingency_removal",
    stage: "inspection",
    title: "Confirm inspection contingency removal received",
    description:
      "Buyer must deliver CR (Contingency Removal) in writing — signature date matters. Until received, deal can still cancel with EMD refund.",
    anchor: "mutual_acceptance",
    offsetDays: 17,
  },

  // ── Closing (anchor = mutual_acceptance) ──
  {
    seedKey: "listing_coordinate_appraisal",
    stage: "appraisal",
    title: "Coordinate appraiser access",
    description:
      "Lender's appraiser — you just coordinate timing. Give them the MLS sheet + list of comps + any improvements the seller's made since last sale.",
    anchor: "mutual_acceptance",
    offsetDays: 14,
  },
  {
    seedKey: "listing_confirm_loan_removal",
    stage: "loan",
    title: "Confirm loan contingency removal received",
    description:
      "Day 21 CA RPA default. Until received, deal can cancel with full EMD refund. Follow up in writing if the buyer's agent is silent.",
    anchor: "mutual_acceptance",
    offsetDays: 21,
  },
  {
    seedKey: "listing_walkthrough_access",
    stage: "closing",
    title: "Schedule buyer's final walkthrough access",
    description:
      "Typically 24-48h before close. Seller should have the home clean + vacant or at agreed condition. Lockbox access OK if seller is gone.",
    anchor: "mutual_acceptance",
    offsetDays: 28,
  },
  {
    seedKey: "listing_seller_sign_appointment",
    stage: "closing",
    title: "Confirm seller signing appointment at escrow",
    description:
      "Or mobile notary if remote. Seller brings government photo ID + any outstanding HOA / utility statements. Remote sellers need to schedule a week out.",
    anchor: "mutual_acceptance",
    offsetDays: 28,
  },
  {
    seedKey: "listing_confirm_closing",
    stage: "closing",
    title: "Confirm funding → recording → keys released",
    description:
      "Listing agent's last job: confirm wire arrived, deed recorded, keys handed off. Seller's proceeds wire goes out same day or next business day.",
    anchor: "mutual_acceptance",
    offsetDays: 30,
  },
];

export function seedTasksFor(type: TransactionType): SeedTask[] {
  if (type === "buyer_rep") return BUYER_REP_SEED_TASKS;
  if (type === "listing_rep") return LISTING_REP_SEED_TASKS;
  // Dual agency: no seed template yet. Agent adds tasks manually.
  return [];
}

export const BUYER_REP_TASK_COUNT = BUYER_REP_SEED_TASKS.length;
export const LISTING_REP_TASK_COUNT = LISTING_REP_SEED_TASKS.length;
