/**
 * Demo workspace seed — pre-populated fake data for the public
 * read-only sandbox at /demo. Every visitor sees the same workspace.
 * Mutations are blocked in the demo shell, so this is the canonical
 * snapshot.
 *
 * Naming convention: contacts use realistic but obviously-fictional
 * first/last name pairings. Phone numbers use the 555 reserved range
 * (per TIA/EIA) so they're never confused with real lines.
 */

export type DemoLifecycleStage = "lead" | "nurture" | "appointment" | "active_client" | "past_client";
export type DemoLeadScore = "A" | "B" | "C";
export type DemoSource =
  | "Zillow"
  | "Realtor.com"
  | "Facebook"
  | "Google LSA"
  | "Open House"
  | "Referral"
  | "IDX website"
  | "Past client";

export type DemoContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: DemoSource;
  stage: DemoLifecycleStage;
  score: DemoLeadScore;
  /** Last activity in plain English, e.g. "AI replied 2 min ago". */
  lastActivity: string;
  lastActivityAtMinAgo: number;
  city: string;
  /** Optional one-line interest summary. */
  interest?: string;
  /** Optional tag — e.g. "Hot · Tour booked". */
  tag?: string;
};

export type DemoConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  /** Sender label — "You", "AI", or contact name. */
  fromLabel: string;
  body: string;
  /** Minutes ago. */
  ago: number;
  /** Tag — used to render an AI badge. */
  aiGenerated?: boolean;
};

export type DemoConversation = {
  id: string;
  contactId: string;
  contactName: string;
  contactCity: string;
  source: DemoSource;
  score: DemoLeadScore;
  /** Snippet shown in the inbox list. */
  preview: string;
  /** Minutes since most recent message. */
  ago: number;
  unread: boolean;
  messages: DemoConversationMessage[];
};

export type DemoDeal = {
  id: string;
  buyerName: string;
  property: string;
  city: string;
  stage:
    | "Under contract"
    | "Inspection"
    | "Appraisal"
    | "Clear to close"
    | "Closed"
    | "Active showing";
  price: number;
  closeDate: string;
  /** Next critical milestone. */
  nextMilestone: string;
  daysToMilestone: number;
};

export type DemoDraft = {
  id: string;
  contactName: string;
  /** Why the AI drafted this — shown inline above the draft. */
  reasoning: string;
  draft: string;
  channel: "sms" | "email";
  /** Minutes since draft was created. */
  ago: number;
};

export type DemoBriefing = {
  id: string;
  emoji: string;
  title: string;
  body: string;
  /** Inline action label. */
  actionLabel: string;
};

export type DemoTask = {
  id: string;
  title: string;
  contactName: string | null;
  priority: "urgent" | "high" | "normal";
  dueLabel: string;
};

export type DemoCalendarEvent = {
  id: string;
  title: string;
  contactName: string;
  when: string;
};

/* ────────────────────────────────────────────────────────────────────
 * Contacts — a 50-row roster that reads like a real solo agent's
 * pipeline. Stage / score / source distributions roughly match a
 * mature pipeline (35% leads, 30% nurture, 15% appointment, 10%
 * active client, 10% past client). The first five rows are
 * intentionally Hot/A-scored so the contacts page tells a strong
 * story from the top.
 * ──────────────────────────────────────────────────────────────────── */

export const DEMO_CONTACTS: DemoContact[] = [
  {
    id: "c-001",
    name: "Sarah M. Chen",
    email: "sarah.chen@example.com",
    phone: "(555) 0123-4567",
    source: "Zillow",
    stage: "appointment",
    score: "A",
    lastActivity: "AI replied 2 min ago — buyer ready to tour",
    lastActivityAtMinAgo: 2,
    city: "Bellevue, WA",
    interest: "3-bed condo · downtown · max $850K",
    tag: "Hot · Tour Saturday",
  },
  {
    id: "c-002",
    name: "James Whitman",
    email: "j.whitman@example.com",
    phone: "(555) 0246-9013",
    source: "Realtor.com",
    stage: "lead",
    score: "A",
    lastActivity: "AI sent first-touch SMS 15 min ago",
    lastActivityAtMinAgo: 15,
    city: "Bothell, WA",
    interest: "First-time buyer · pre-approved $620K",
    tag: "First-time · pre-approved",
  },
  {
    id: "c-003",
    name: "Lisa K. Park",
    email: "lisa.park@example.com",
    phone: "(555) 0354-1180",
    source: "Open House",
    stage: "lead",
    score: "A",
    lastActivity: "Signed in at 4456 Maple Ave open house",
    lastActivityAtMinAgo: 45,
    city: "Kirkland, WA",
    interest: "Open-house lead · upgrading from condo",
    tag: "Same-day open house",
  },
  {
    id: "c-004",
    name: "David Ramos",
    email: "d.ramos@example.com",
    phone: "(555) 0418-7732",
    source: "Facebook",
    stage: "nurture",
    score: "B",
    lastActivity: "Replied yesterday — wants to talk Tuesday",
    lastActivityAtMinAgo: 21 * 60,
    city: "Redmond, WA",
    interest: "Investor · multifamily focus",
  },
  {
    id: "c-005",
    name: "Mark Davis",
    email: "mark.davis@example.com",
    phone: "(555) 0507-3344",
    source: "Past client",
    stage: "active_client",
    score: "A",
    lastActivity: "CMA delivered · listing presentation Tue 2pm",
    lastActivityAtMinAgo: 4 * 60,
    city: "Sammamish, WA",
    interest: "Selling — $1.2M est",
    tag: "Listing presentation Tue",
  },
  // 45 more — round-robin sources, scores, stages
  { id: "c-006", name: "Aisha Patel", email: "aisha.p@example.com", phone: "(555) 0601-9921", source: "Zillow", stage: "lead", score: "B", lastActivity: "AI sequence step 2 sent 1h ago", lastActivityAtMinAgo: 60, city: "Seattle, WA" },
  { id: "c-007", name: "Marcus Williams", email: "m.williams@example.com", phone: "(555) 0712-3344", source: "Referral", stage: "nurture", score: "B", lastActivity: "Browsing /homes — 4 properties this week", lastActivityAtMinAgo: 3 * 60, city: "Issaquah, WA" },
  { id: "c-008", name: "Emily Tanaka", email: "e.tanaka@example.com", phone: "(555) 0823-1188", source: "IDX website", stage: "lead", score: "B", lastActivity: "Submitted home-value request", lastActivityAtMinAgo: 90, city: "Renton, WA" },
  { id: "c-009", name: "Carlos Mendez", email: "c.mendez@example.com", phone: "(555) 0934-7766", source: "Google LSA", stage: "lead", score: "B", lastActivity: "AI text-back fired · waiting on reply", lastActivityAtMinAgo: 22, city: "Burien, WA" },
  { id: "c-010", name: "Jennifer Holm", email: "j.holm@example.com", phone: "(555) 1045-5522", source: "Realtor.com", stage: "appointment", score: "A", lastActivity: "Tour booked Wed 5pm — 8124 Pine St", lastActivityAtMinAgo: 5 * 60, city: "Edmonds, WA" },
  { id: "c-011", name: "Daniel O'Connor", email: "d.oconnor@example.com", phone: "(555) 1156-8801", source: "Past client", stage: "past_client", score: "B", lastActivity: "Anniversary check-in sent · responded warmly", lastActivityAtMinAgo: 24 * 60, city: "Mercer Island, WA", interest: "Closed Mar 2022 · sphere candidate" },
  { id: "c-012", name: "Priya Kapoor", email: "p.kapoor@example.com", phone: "(555) 1267-3399", source: "Facebook", stage: "nurture", score: "C", lastActivity: "Opened email · no click", lastActivityAtMinAgo: 6 * 60, city: "Tukwila, WA" },
  { id: "c-013", name: "Robert Hsu", email: "r.hsu@example.com", phone: "(555) 1378-2244", source: "Open House", stage: "lead", score: "B", lastActivity: "Open-house sign-in · 2 days ago", lastActivityAtMinAgo: 2 * 24 * 60, city: "Newcastle, WA" },
  { id: "c-014", name: "Hannah Brooks", email: "h.brooks@example.com", phone: "(555) 1489-5577", source: "Zillow", stage: "lead", score: "A", lastActivity: "AI follow-up: replied within 38 sec", lastActivityAtMinAgo: 38, city: "Kenmore, WA" },
  { id: "c-015", name: "Tony Nguyen", email: "t.nguyen@example.com", phone: "(555) 1590-1133", source: "Referral", stage: "active_client", score: "A", lastActivity: "Offer accepted — under contract", lastActivityAtMinAgo: 8 * 60, city: "Lynnwood, WA", tag: "Under contract" },
  { id: "c-016", name: "Maria Ferreira", email: "m.ferreira@example.com", phone: "(555) 1601-8822", source: "Past client", stage: "past_client", score: "C", lastActivity: "Quarterly check-in queued", lastActivityAtMinAgo: 90 * 24 * 60, city: "Tacoma, WA" },
  { id: "c-017", name: "Benjamin Walsh", email: "b.walsh@example.com", phone: "(555) 1712-4477", source: "IDX website", stage: "lead", score: "C", lastActivity: "Saved-search alert dispatched", lastActivityAtMinAgo: 18 * 60, city: "Federal Way, WA" },
  { id: "c-018", name: "Sophia Reyes", email: "s.reyes@example.com", phone: "(555) 1823-9911", source: "Zillow", stage: "lead", score: "B", lastActivity: "AI sequence step 3 sent · awaiting reply", lastActivityAtMinAgo: 4 * 60, city: "Auburn, WA" },
  { id: "c-019", name: "Kevin Adler", email: "k.adler@example.com", phone: "(555) 1934-6633", source: "Google LSA", stage: "nurture", score: "B", lastActivity: "Visited /mortgage-calculator twice this week", lastActivityAtMinAgo: 13 * 60, city: "Lakewood, WA" },
  { id: "c-020", name: "Olivia Park", email: "o.park@example.com", phone: "(555) 2045-3322", source: "Open House", stage: "appointment", score: "A", lastActivity: "Buyer tour scheduled Sat 11am", lastActivityAtMinAgo: 7 * 60, city: "Bonney Lake, WA", tag: "Tour Saturday" },
  { id: "c-021", name: "Anthony Park", email: "a.park@example.com", phone: "(555) 2156-7799", source: "Facebook", stage: "lead", score: "C", lastActivity: "Bot-filtered — flagged as low-intent", lastActivityAtMinAgo: 26 * 60, city: "Puyallup, WA" },
  { id: "c-022", name: "Rachel Kim", email: "r.kim@example.com", phone: "(555) 2267-1144", source: "Referral", stage: "active_client", score: "A", lastActivity: "Showing feedback received — strong interest", lastActivityAtMinAgo: 11 * 60, city: "Bellevue, WA" },
  { id: "c-023", name: "Greg Steinberg", email: "g.steinberg@example.com", phone: "(555) 2378-8866", source: "Past client", stage: "past_client", score: "B", lastActivity: "Sphere score: high (equity + life event)", lastActivityAtMinAgo: 30 * 24 * 60, city: "Magnolia, WA", interest: "Closed Jun 2020 · likely seller" },
  { id: "c-024", name: "Linda Pham", email: "l.pham@example.com", phone: "(555) 2489-2255", source: "IDX website", stage: "lead", score: "B", lastActivity: "Newsletter open · clicked listing", lastActivityAtMinAgo: 7 * 60, city: "Shoreline, WA" },
  { id: "c-025", name: "Michael Yo", email: "m.yo@example.com", phone: "(555) 2590-4488", source: "Zillow", stage: "nurture", score: "B", lastActivity: "Mid-funnel drip · day 14 of 30", lastActivityAtMinAgo: 9 * 60, city: "Lake Forest Park, WA" },
  { id: "c-026", name: "Caroline Sato", email: "c.sato@example.com", phone: "(555) 2601-7711", source: "Realtor.com", stage: "lead", score: "C", lastActivity: "Single-page visit · no engagement signal", lastActivityAtMinAgo: 36 * 60, city: "Mountlake Terrace, WA" },
  { id: "c-027", name: "Brandon Holmes", email: "b.holmes@example.com", phone: "(555) 2712-9933", source: "Open House", stage: "lead", score: "B", lastActivity: "Open-house sign-in · viewed twice", lastActivityAtMinAgo: 16 * 60, city: "Woodinville, WA" },
  { id: "c-028", name: "Erin Coleman", email: "e.coleman@example.com", phone: "(555) 2823-5500", source: "Facebook", stage: "lead", score: "B", lastActivity: "Replied to Q3 ad — wants new construction", lastActivityAtMinAgo: 4 * 60, city: "Mill Creek, WA" },
  { id: "c-029", name: "Andrew Chiu", email: "a.chiu@example.com", phone: "(555) 2934-1177", source: "Referral", stage: "appointment", score: "A", lastActivity: "Consultation booked — Thu 3pm", lastActivityAtMinAgo: 12 * 60, city: "Cottage Lake, WA" },
  { id: "c-030", name: "Vanessa Crowe", email: "v.crowe@example.com", phone: "(555) 3045-8822", source: "Past client", stage: "past_client", score: "A", lastActivity: "Sphere score: very high · 5 yrs since close", lastActivityAtMinAgo: 5 * 24 * 60, city: "Snohomish, WA", interest: "Closed Jun 2020 · 35% equity growth" },
  { id: "c-031", name: "Tyler Greene", email: "t.greene@example.com", phone: "(555) 3156-4499", source: "IDX website", stage: "nurture", score: "B", lastActivity: "Saved 3 properties — Cap Hill", lastActivityAtMinAgo: 19 * 60, city: "Seattle, WA" },
  { id: "c-032", name: "Lily Zhang", email: "l.zhang@example.com", phone: "(555) 3267-1166", source: "Google LSA", stage: "lead", score: "B", lastActivity: "Voice-AI call answered · 4-min convo", lastActivityAtMinAgo: 1 * 60, city: "Bellevue, WA", tag: "Voice AI conversion" },
  { id: "c-033", name: "Jordan Mitchell", email: "j.mitchell@example.com", phone: "(555) 3378-7733", source: "Zillow", stage: "lead", score: "C", lastActivity: "Auto-replied · no engagement back", lastActivityAtMinAgo: 11 * 60, city: "SeaTac, WA" },
  { id: "c-034", name: "Mona Khan", email: "m.khan@example.com", phone: "(555) 3489-2244", source: "Facebook", stage: "nurture", score: "C", lastActivity: "Cold reader · monthly newsletter only", lastActivityAtMinAgo: 5 * 24 * 60, city: "Kent, WA" },
  { id: "c-035", name: "Ryan Donovan", email: "r.donovan@example.com", phone: "(555) 3590-5577", source: "Open House", stage: "lead", score: "B", lastActivity: "Open-house lead · tour Sat afternoon", lastActivityAtMinAgo: 10 * 60, city: "Brier, WA" },
  { id: "c-036", name: "Natalie Bowers", email: "n.bowers@example.com", phone: "(555) 3601-3388", source: "Referral", stage: "appointment", score: "A", lastActivity: "Listing prep walkthrough Mon 4pm", lastActivityAtMinAgo: 6 * 60, city: "Mukilteo, WA", tag: "Seller — listing prep" },
  { id: "c-037", name: "Ben Schaefer", email: "b.schaefer@example.com", phone: "(555) 3712-9911", source: "Past client", stage: "past_client", score: "B", lastActivity: "Birthday card auto-sent · responded", lastActivityAtMinAgo: 8 * 60, city: "Marysville, WA" },
  { id: "c-038", name: "Yuna Park", email: "y.park@example.com", phone: "(555) 3823-6644", source: "IDX website", stage: "lead", score: "B", lastActivity: "Mortgage calculator share · sent to fiancé", lastActivityAtMinAgo: 3 * 60, city: "Everett, WA" },
  { id: "c-039", name: "Cole Pearson", email: "c.pearson@example.com", phone: "(555) 3934-2255", source: "Zillow", stage: "lead", score: "B", lastActivity: "Multi-portal lead · dedupe-merged", lastActivityAtMinAgo: 14 * 60, city: "Bothell, WA" },
  { id: "c-040", name: "Selena Brooks", email: "s.brooks@example.com", phone: "(555) 4045-9966", source: "Realtor.com", stage: "lead", score: "B", lastActivity: "AI follow-up step 2 sent", lastActivityAtMinAgo: 21 * 60, city: "Bellevue, WA" },
  { id: "c-041", name: "Joel Westbrook", email: "j.westbrook@example.com", phone: "(555) 4156-4477", source: "Facebook", stage: "nurture", score: "B", lastActivity: "Replied yesterday — interested in new builds", lastActivityAtMinAgo: 22 * 60, city: "Sammamish, WA" },
  { id: "c-042", name: "Hannah Lim", email: "h.lim@example.com", phone: "(555) 4267-8811", source: "Referral", stage: "active_client", score: "A", lastActivity: "Inspection scheduled · 7124 Aspen Ct", lastActivityAtMinAgo: 9 * 60, city: "Issaquah, WA", tag: "Under contract" },
  { id: "c-043", name: "Quentin Park", email: "q.park@example.com", phone: "(555) 4378-3322", source: "Past client", stage: "past_client", score: "C", lastActivity: "Newsletter open — first in 6 mo", lastActivityAtMinAgo: 4 * 60, city: "Lake Stevens, WA" },
  { id: "c-044", name: "Reyna Whitfield", email: "r.whitfield@example.com", phone: "(555) 4489-1144", source: "Google LSA", stage: "lead", score: "B", lastActivity: "Voice-AI · request callback Tue morning", lastActivityAtMinAgo: 90, city: "Burien, WA" },
  { id: "c-045", name: "Amir Salem", email: "a.salem@example.com", phone: "(555) 4590-7755", source: "Zillow", stage: "lead", score: "A", lastActivity: "AI text-back: 19 sec response time", lastActivityAtMinAgo: 19, city: "Redmond, WA", tag: "Sub-minute response" },
  { id: "c-046", name: "Talia Boyd", email: "t.boyd@example.com", phone: "(555) 4601-2233", source: "IDX website", stage: "lead", score: "C", lastActivity: "Browsing /homes — 2 pages", lastActivityAtMinAgo: 33 * 60, city: "Olympia, WA" },
  { id: "c-047", name: "Wesley Foster", email: "w.foster@example.com", phone: "(555) 4712-5566", source: "Open House", stage: "nurture", score: "B", lastActivity: "Sign-in 5 days ago · drip step 3", lastActivityAtMinAgo: 5 * 24 * 60, city: "Tacoma, WA" },
  { id: "c-048", name: "Karen Larson", email: "k.larson@example.com", phone: "(555) 4823-1100", source: "Referral", stage: "appointment", score: "A", lastActivity: "Closing call tomorrow 10am", lastActivityAtMinAgo: 14 * 60, city: "Steilacoom, WA", tag: "Closing tomorrow" },
  { id: "c-049", name: "Diego Ortiz", email: "d.ortiz@example.com", phone: "(555) 4934-8844", source: "Past client", stage: "past_client", score: "A", lastActivity: "Equity letter delivered — 38% appreciation", lastActivityAtMinAgo: 12 * 60, city: "Spokane, WA", interest: "Closed Feb 2019 · investor lead potential" },
  { id: "c-050", name: "Eve Pillsbury", email: "e.pillsbury@example.com", phone: "(555) 5045-3377", source: "Facebook", stage: "lead", score: "B", lastActivity: "AI escalated · price negotiation question", lastActivityAtMinAgo: 7, city: "Bellevue, WA", tag: "Escalated · needs you" },
];

/* ────────────────────────────────────────────────────────────────────
 * Conversations — the inbox view. Each conversation has 4–8 messages
 * showing the AI follow-up loop: inbound lead → AI reply within 60s
 * → lead response → AI continuation. The first conversation (Sarah)
 * is the showcase — full sequence ending in a booked tour.
 * ──────────────────────────────────────────────────────────────────── */

export const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    id: "conv-001",
    contactId: "c-001",
    contactName: "Sarah M. Chen",
    contactCity: "Bellevue, WA",
    source: "Zillow",
    score: "A",
    preview: "AI: \"Saturday 11am works — let me confirm with the listing agent.\"",
    ago: 2,
    unread: false,
    messages: [
      { id: "m-1", direction: "inbound", channel: "sms", fromLabel: "Sarah", body: "Hi! I saw the listing at 4456 Maple Ave on Zillow. Is it still available?", ago: 47 },
      { id: "m-2", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Hi Sarah — yes, 4456 Maple is still active. It's a 3-bed condo at $785K. Are you looking in that range, or open to a few options?", ago: 46, aiGenerated: true },
      { id: "m-3", direction: "inbound", channel: "sms", fromLabel: "Sarah", body: "Yes, $785K is my range. Pre-approved up to $850. Would love to see it this week.", ago: 32 },
      { id: "m-4", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Perfect. I have Saturday 11am or Sunday 2pm open with the listing agent. Which works better?", ago: 31, aiGenerated: true },
      { id: "m-5", direction: "inbound", channel: "sms", fromLabel: "Sarah", body: "Saturday 11am please!", ago: 4 },
      { id: "m-6", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Saturday 11am works — let me confirm with the listing agent and you'll get a calendar invite within the hour. Also pulling up 2 similar condos in the area in case you want a tour day.", ago: 2, aiGenerated: true },
    ],
  },
  {
    id: "conv-002",
    contactId: "c-002",
    contactName: "James Whitman",
    contactCity: "Bothell, WA",
    source: "Realtor.com",
    score: "A",
    preview: "AI: \"What's your move-in window? I can pull a few options that fit your $620K budget.\"",
    ago: 15,
    unread: true,
    messages: [
      { id: "m-1", direction: "inbound", channel: "sms", fromLabel: "James", body: "Just saw the 3-bed in Bothell on realtor.com. Are open houses planned?", ago: 16 },
      { id: "m-2", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Hi James — that one's listed at $625K. No open house this weekend but I can set up a private tour. What's your move-in window? I can pull a few options that fit your $620K budget.", ago: 15, aiGenerated: true },
    ],
  },
  {
    id: "conv-003",
    contactId: "c-050",
    contactName: "Eve Pillsbury",
    contactCity: "Bellevue, WA",
    source: "Facebook",
    score: "B",
    preview: "AI escalated — pricing question outside auto-reply scope",
    ago: 7,
    unread: true,
    messages: [
      { id: "m-1", direction: "inbound", channel: "sms", fromLabel: "Eve", body: "If we offer $740K on the Maple Ave listing, what should we expect for closing costs after concessions?", ago: 8 },
      { id: "m-2", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Great question Eve — let me loop in your agent on the negotiation specifics. Michael will reply within the hour.", ago: 7, aiGenerated: true },
    ],
  },
  {
    id: "conv-004",
    contactId: "c-045",
    contactName: "Amir Salem",
    contactCity: "Redmond, WA",
    source: "Zillow",
    score: "A",
    preview: "AI: \"Got it — emailing comps for the 6300 block of Redmond Way now.\"",
    ago: 19,
    unread: false,
    messages: [
      { id: "m-1", direction: "inbound", channel: "sms", fromLabel: "Amir", body: "Inquiry on 6312 Redmond Way", ago: 20 },
      { id: "m-2", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Hey Amir — 6312 Redmond Way is a 4-bed at $1.05M, currently active. Want to see it this weekend, or get a CMA on the area first?", ago: 20, aiGenerated: true },
      { id: "m-3", direction: "inbound", channel: "sms", fromLabel: "Amir", body: "Comps first please", ago: 19 },
      { id: "m-4", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Got it — emailing comps for the 6300 block of Redmond Way now. You'll see 4 recent sales + 2 actives. Reply if you want me to flag any for a tour.", ago: 19, aiGenerated: true },
    ],
  },
  {
    id: "conv-005",
    contactId: "c-032",
    contactName: "Lily Zhang",
    contactCity: "Bellevue, WA",
    source: "Google LSA",
    score: "B",
    preview: "Voice AI call · 4 min summary attached to contact",
    ago: 60,
    unread: false,
    messages: [
      { id: "m-1", direction: "inbound", channel: "sms", fromLabel: "Voice AI", body: "(Voice call summary) Lily called from a Google LSA ad about Bellevue condos. Mentioned budget $700K, prefers 2-bed, urgency: looking to close in 60 days. Booked a callback for Tue 10am.", ago: 60, aiGenerated: true },
      { id: "m-2", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Hi Lily — confirming our Tuesday 10am callback. Sending you 3 Bellevue 2-bed condos under $700K in the meantime — take a look and I'll be ready to discuss what catches your eye.", ago: 58, aiGenerated: true },
    ],
  },
  {
    id: "conv-006",
    contactId: "c-014",
    contactName: "Hannah Brooks",
    contactCity: "Kenmore, WA",
    source: "Zillow",
    score: "A",
    preview: "AI replied in 38 sec · awaiting Hannah's response",
    ago: 38,
    unread: false,
    messages: [
      { id: "m-1", direction: "inbound", channel: "sms", fromLabel: "Hannah", body: "Sent from Zillow on 8852 Kenmore Place. Open to a tour next week.", ago: 39 },
      { id: "m-2", direction: "outbound", channel: "sms", fromLabel: "AI", body: "Hi Hannah — got your Zillow inquiry. 8852 Kenmore Place is a 4-bed at $895K. I have Mon 6pm or Thu 5pm next week — which works?", ago: 38, aiGenerated: true },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────────
 * Deals — active pipeline. Mix of stages to show the transaction
 * coordinator at work.
 * ──────────────────────────────────────────────────────────────────── */

export const DEMO_DEALS: DemoDeal[] = [
  {
    id: "d-001",
    buyerName: "Tony Nguyen",
    property: "7124 Aspen Ct, Lynnwood",
    city: "Lynnwood, WA",
    stage: "Under contract",
    price: 689000,
    closeDate: "Jun 18, 2026",
    nextMilestone: "Inspection scheduled",
    daysToMilestone: 3,
  },
  {
    id: "d-002",
    buyerName: "Hannah Lim",
    property: "4456 Maple Ave, Issaquah",
    city: "Issaquah, WA",
    stage: "Inspection",
    price: 925000,
    closeDate: "Jun 24, 2026",
    nextMilestone: "Appraisal due",
    daysToMilestone: 5,
  },
  {
    id: "d-003",
    buyerName: "Karen Larson",
    property: "12 Lakefront Dr, Steilacoom",
    city: "Steilacoom, WA",
    stage: "Clear to close",
    price: 1140000,
    closeDate: "Jun 12, 2026",
    nextMilestone: "Closing call tomorrow",
    daysToMilestone: 1,
  },
  {
    id: "d-004",
    buyerName: "Rachel Kim",
    property: "2204 Wilshire Pl, Bellevue",
    city: "Bellevue, WA",
    stage: "Active showing",
    price: 1450000,
    closeDate: "—",
    nextMilestone: "2nd showing booked",
    daysToMilestone: 2,
  },
];

/* ────────────────────────────────────────────────────────────────────
 * AI drafts — the review queue. Shows the AI catching context other
 * platforms would miss.
 * ──────────────────────────────────────────────────────────────────── */

export const DEMO_DRAFTS: DemoDraft[] = [
  {
    id: "dr-001",
    contactName: "David Ramos",
    reasoning: "David asked about Tuesday — proposing two specific time slots based on your calendar availability.",
    draft: "Hey David — Tuesday works! I have 11am or 3pm open. Want to grab coffee at Vivace? It's a block from the Westlake listing I'd love to walk you through. Either time work?",
    channel: "sms",
    ago: 12,
  },
  {
    id: "dr-002",
    contactName: "Greg Steinberg",
    reasoning: "30-day sphere check-in trigger fired (closed Jun 2020). Adding equity stat from recent comp pulls.",
    draft: "Hi Greg — quick check-in: noticed prices in Magnolia have moved 38% since you bought in 2020. Curious where you're at on your end — staying put, or thinking about what's next? Happy to pull a current value report whenever you want one.",
    channel: "email",
    ago: 28,
  },
  {
    id: "dr-003",
    contactName: "Lily Zhang",
    reasoning: "Following up on Tuesday 10am callback that's now 36 hours out. Adding three matched properties to the message.",
    draft: "Hi Lily — looking forward to our Tuesday 10am call. To get a head start, I pulled 3 Bellevue 2-bed condos under $700K that I think you'll like:\n• 1424 Bellevue Way #302 — $689K (just listed)\n• 8801 Lake Hills Ln — $645K\n• 12 Park Pointe #5 — $695K\nLet me know if any catch your eye and we can walk through them on the call.",
    channel: "sms",
    ago: 4,
  },
  {
    id: "dr-004",
    contactName: "Vanessa Crowe",
    reasoning: "Sphere score very high (5 yrs since close, 35% equity growth, life event: new child). Soft seller-prospecting nudge.",
    draft: "Hey Vanessa — congrats on the new arrival! Quick thought: now that you've outgrown the Snohomish place, want to see what it would sell for today? Pulled a quick comp and your home's worth about $725K (you bought at $540K). No pressure — just thought you'd want to know.",
    channel: "sms",
    ago: 45,
  },
  {
    id: "dr-005",
    contactName: "Olivia Park",
    reasoning: "24h reminder before Saturday tour. Including parking + access notes pulled from the listing.",
    draft: "Hey Olivia — reminder about tomorrow's tour at 9824 Foothill Way, 11am. Easiest parking is on Cedar St (one block north). I'll meet you at the front door. Bring questions — it's a 4-bed and the basement has been recently finished, would love your read.",
    channel: "sms",
    ago: 6,
  },
];

/* ────────────────────────────────────────────────────────────────────
 * Tasks, calendar events, briefings — the rest of the overview page.
 * ──────────────────────────────────────────────────────────────────── */

export const DEMO_TASKS: DemoTask[] = [
  { id: "t-001", title: "Confirm Saturday 11am tour with listing agent", contactName: "Sarah M. Chen", priority: "urgent", dueLabel: "Today, 4:00pm" },
  { id: "t-002", title: "Reply to Eve — price negotiation question (AI escalated)", contactName: "Eve Pillsbury", priority: "urgent", dueLabel: "Today, 5:30pm" },
  { id: "t-003", title: "Send CMA — listing presentation Tue 2pm", contactName: "Mark Davis", priority: "high", dueLabel: "Tomorrow, 10am" },
  { id: "t-004", title: "Closing call with Karen Larson", contactName: "Karen Larson", priority: "high", dueLabel: "Tomorrow, 10am" },
  { id: "t-005", title: "Listing prep walkthrough with Natalie", contactName: "Natalie Bowers", priority: "normal", dueLabel: "Mon, 4pm" },
];

export const DEMO_EVENTS: DemoCalendarEvent[] = [
  { id: "e-001", title: "Tour — 4456 Maple Ave with Sarah Chen", contactName: "Sarah M. Chen", when: "Sat 11:00am" },
  { id: "e-002", title: "Listing presentation — Mark Davis", contactName: "Mark Davis", when: "Tue 2:00pm" },
  { id: "e-003", title: "Closing call — Karen Larson", contactName: "Karen Larson", when: "Tomorrow 10:00am" },
  { id: "e-004", title: "Callback — Lily Zhang", contactName: "Lily Zhang", when: "Tue 10:00am" },
  { id: "e-005", title: "Listing prep — Natalie Bowers", contactName: "Natalie Bowers", when: "Mon 4:00pm" },
];

export const DEMO_BRIEFINGS: DemoBriefing[] = [
  {
    id: "br-001",
    emoji: "⚡",
    title: "AI handled 14 lead replies overnight",
    body: "Median response time: 47 seconds. 3 leads booked tours; 2 are waiting on your input.",
    actionLabel: "Review AI drafts",
  },
  {
    id: "br-002",
    emoji: "📞",
    title: "Voice AI answered 4 inbound calls",
    body: "All transcribed + summarized. One caller (Lily Zhang) requested a Tuesday callback.",
    actionLabel: "View call summaries",
  },
  {
    id: "br-003",
    emoji: "🎯",
    title: "Vanessa Crowe is at peak sphere score",
    body: "5 years since close + 35% equity growth + life event signal. Auto-draft is in your queue.",
    actionLabel: "Review sphere outreach",
  },
];

/* ────────────────────────────────────────────────────────────────────
 * KPI snapshot for the overview page.
 * ──────────────────────────────────────────────────────────────────── */

export const DEMO_KPIS = {
  newLeadsToday: 7,
  hotLeads: 12,
  messagesSent: 38,
  quietLeads: 4,
  weeklyResponseTimeSec: 52,
  weeklyTours: 9,
  weeklyClosings: 1,
};
