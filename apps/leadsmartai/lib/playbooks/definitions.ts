/**
 * Static playbook library. Curated by domain experts, shipped as code
 * so every agent gets improvements the moment we deploy.
 *
 * Each `offsetDays` is relative to the anchor date the agent picks.
 * Negative values = "before anchor" (prep), positive = "after anchor"
 * (follow-up). Tasks are grouped into sections purely for display.
 *
 * When adding a playbook: keep items actionable and short. The agent
 * should be able to glance + tick, not read a paragraph.
 */

export type PlaybookAnchor = "transaction" | "open_house" | "contact" | "generic";

export type PlaybookItem = {
  title: string;
  notes?: string;
  section?: string;
  offsetDays: number;
};

export type Playbook = {
  key: string;
  category: "offer" | "open_house" | "listing" | "closing";
  title: string;
  description: string;
  // Which anchor types make sense. An offer writing playbook gets
  // applied to a transaction (or contact if there's no txn yet);
  // an open-house playbook to an open_house row; etc.
  validAnchors: PlaybookAnchor[];
  anchorHint: string; // one-liner telling the agent what to pick for the anchor date
  items: PlaybookItem[];
};

export const PLAYBOOKS: Playbook[] = [
  {
    key: "write_offer",
    category: "offer",
    title: "Write an offer",
    description:
      "Prep through submission for a buyer-rep offer. Anchor = planned offer submission date.",
    validAnchors: ["transaction", "contact", "generic"],
    anchorHint: "Planned submit date",
    items: [
      // Prep
      {
        section: "Prep",
        title: "Pull comps for the subject property",
        notes: "3 closed in the last 90 days, 2 active, 1 pending. Note $/sqft spread.",
        offsetDays: -3,
      },
      {
        section: "Prep",
        title: "Confirm buyer pre-approval is current",
        notes: "Letter dated within 30 days, amount ≥ intended offer.",
        offsetDays: -3,
      },
      {
        section: "Prep",
        title: "Review listing disclosures + seller counter-pref sheet",
        notes: "Look for disclosed items to price in. Flag any red-flag items to the buyer.",
        offsetDays: -2,
      },
      {
        section: "Prep",
        title: "Call listing agent — ask how many offers expected + seller priorities",
        notes: "Timeline, as-is vs inspection, rent-back, EM expectations.",
        offsetDays: -2,
      },
      {
        section: "Prep",
        title: "Decide offer terms with buyer",
        notes: "Price, EM, contingencies (inspection/appraisal/loan), close date, seller concessions.",
        offsetDays: -1,
      },
      // Submit
      {
        section: "Submit",
        title: "Draft RPA + counter terms + addenda in zipForm",
        offsetDays: 0,
      },
      {
        section: "Submit",
        title: "Draft cover letter to listing agent",
        notes: "Strengths: buyer financial position, clean terms, flexibility. Keep under 200 words.",
        offsetDays: 0,
      },
      {
        section: "Submit",
        title: "Send offer package + pre-approval + EM proof",
        offsetDays: 0,
      },
      // Follow-up
      {
        section: "Follow-up",
        title: "Confirm receipt with listing agent",
        notes: "Text them. Don't leave it silent.",
        offsetDays: 0,
      },
      {
        section: "Follow-up",
        title: "Check in if no response by end-of-next-day",
        offsetDays: 1,
      },
      {
        section: "Follow-up",
        title: "Log outcome (accepted / countered / rejected) + update buyer",
        offsetDays: 2,
      },
    ],
  },
  {
    key: "host_open_house",
    category: "open_house",
    title: "Host an open house",
    description:
      "Prep, day-of, and follow-up. Anchor = the open-house date.",
    validAnchors: ["open_house", "transaction", "generic"],
    anchorHint: "Open house date",
    items: [
      // Before
      {
        section: "1 week before",
        title: "Confirm open house with seller + neighbors",
        notes: "Courtesy notice to immediate neighbors keeps the peace.",
        offsetDays: -7,
      },
      {
        section: "1 week before",
        title: "Order yard signs + directional arrows",
        notes: "Check intersections — minimum 4 pointers, more if on a side street.",
        offsetDays: -7,
      },
      {
        section: "1 week before",
        title: "Send invite blast to sphere + past clients in area",
        offsetDays: -6,
      },
      {
        section: "3 days before",
        title: "Print flyers + sign-in sheets (or prep iPad kiosk)",
        notes: "If iPad: test the sign-in URL + QR code today, not day-of.",
        offsetDays: -3,
      },
      {
        section: "3 days before",
        title: "Schedule broker preview (optional)",
        offsetDays: -3,
      },
      {
        section: "3 days before",
        title: "Confirm MLS listing has open-house entry with correct time",
        offsetDays: -3,
      },
      {
        section: "Day before",
        title: "Walk through + declutter touch-ups + music + snacks shopping",
        offsetDays: -1,
      },
      // Day of
      {
        section: "Day of",
        title: "Arrive 45 min early — set signs, open windows, light candles",
        offsetDays: 0,
      },
      {
        section: "Day of",
        title: "Launch iPad kiosk + verify online sync",
        notes: "Home screen installed, airplane-mode test the queue flush.",
        offsetDays: 0,
      },
      {
        section: "Day of",
        title: "Greet every visitor + sign-in prompt",
        offsetDays: 0,
      },
      // After
      {
        section: "After",
        title: "Pick up signs + lock up",
        offsetDays: 0,
      },
      {
        section: "After",
        title: "Send thank-you to every opted-in visitor",
        notes: "Auto-sent next-day, but skim the list for VIPs worth a personal touch.",
        offsetDays: 1,
      },
      {
        section: "After",
        title: "Seller recap: visitor count, hot leads, feedback themes",
        offsetDays: 1,
      },
      {
        section: "After",
        title: "3-day check-in with hot-timeline visitors",
        offsetDays: 3,
      },
    ],
  },
  {
    key: "seller_presentation",
    category: "listing",
    title: "Seller presentation",
    description:
      "Prep through listing agreement. Anchor = presentation meeting date.",
    validAnchors: ["contact", "transaction", "generic"],
    anchorHint: "Presentation meeting date",
    items: [
      // Prep
      {
        section: "Prep",
        title: "Build CMA (3 closed, 3 active, 3 pending)",
        notes: "Adjust for condition, views, updates. Document your reasoning.",
        offsetDays: -5,
      },
      {
        section: "Prep",
        title: "Draft marketing plan (photos, video, staging, MLS, social)",
        offsetDays: -4,
      },
      {
        section: "Prep",
        title: "Prepare listing presentation deck",
        notes: "Your wins + market data + pricing strategy + marketing timeline + next steps.",
        offsetDays: -3,
      },
      {
        section: "Prep",
        title: "Pre-walk the property (if possible) to refine price/staging",
        offsetDays: -2,
      },
      {
        section: "Prep",
        title: "Send pre-meeting materials to seller",
        notes: "Short teaser + link to your agent profile. Not the full deck — save for the meeting.",
        offsetDays: -1,
      },
      // During
      {
        section: "During meeting",
        title: "Walk the property (if not done already)",
        offsetDays: 0,
      },
      {
        section: "During meeting",
        title: "Present CMA + pricing strategy",
        notes: "Anchor high, justify with data, ask for their gut-reaction number.",
        offsetDays: 0,
      },
      {
        section: "During meeting",
        title: "Walk through marketing plan + timeline",
        offsetDays: 0,
      },
      {
        section: "During meeting",
        title: "Ask for the business + sign listing agreement",
        offsetDays: 0,
      },
      // Post
      {
        section: "After",
        title: "Send listing agreement + disclosures for signature (if not signed live)",
        offsetDays: 0,
      },
      {
        section: "After",
        title: "Schedule photographer + staging walk-through",
        offsetDays: 1,
      },
      {
        section: "After",
        title: "Thank-you note to seller + kickoff next-steps checklist",
        offsetDays: 2,
      },
    ],
  },
  {
    key: "listing_launch",
    category: "listing",
    title: "Listing launch week",
    description:
      "Day of MLS go-live through the critical first 72 hours. Anchor = MLS live date.",
    validAnchors: ["transaction", "generic"],
    anchorHint: "MLS go-live date",
    items: [
      {
        section: "Go-live day",
        title: "MLS listing goes live + verify all fields + photos",
        notes: "Beds/baths/sqft/year/schools/HOA. Typos kill credibility.",
        offsetDays: 0,
      },
      {
        section: "Go-live day",
        title: "Push to Zillow/Redfin/realtor.com (auto, but verify)",
        offsetDays: 0,
      },
      {
        section: "Go-live day",
        title: "Social media announcement (IG reel, FB post, stories)",
        offsetDays: 0,
      },
      {
        section: "Go-live day",
        title: "Email blast to sphere + buyer-agent circle",
        offsetDays: 0,
      },
      {
        section: "First 48h",
        title: "Monitor views/saves/showings + respond to every inquiry",
        offsetDays: 1,
      },
      {
        section: "First 48h",
        title: "Schedule broker preview or agent caravan",
        offsetDays: 1,
      },
      {
        section: "72h review",
        title: "Seller check-in: stats + market feedback",
        notes: "If showings < expected, start the pricing conversation EARLY.",
        offsetDays: 3,
      },
      {
        section: "First week",
        title: "Open house #1",
        offsetDays: 6,
      },
    ],
  },
];

export function getPlaybook(key: string): Playbook | null {
  return PLAYBOOKS.find((p) => p.key === key) ?? null;
}

export function playbooksForAnchor(anchor: PlaybookAnchor): Playbook[] {
  return PLAYBOOKS.filter((p) => p.validAnchors.includes(anchor));
}
