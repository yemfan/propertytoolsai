/**
 * Help guides — short how-to articles for /help/guides/[slug].
 *
 * Each guide produces an Article + HowTo JSON-LD payload so it
 * can earn rich-result eligibility on long-tail "how do I X with
 * LeadSmart" queries. Content is intentionally concise — the goal
 * is a useful first-result answer, not an exhaustive manual.
 *
 * Adding a guide: pick a slug that matches the search query the
 * agent would type, write 4–7 numbered steps, keep `body`
 * paragraphs short, and link to the relevant in-app surface so
 * readers can act immediately.
 */

export type HelpGuide = {
  slug: string;
  title: string;
  /** Meta description + OG description. Keep under 160 chars. */
  description: string;
  /** Estimated read/do time (e.g. "3 min"). */
  readTime: string;
  /** Sub-section under which this guide is grouped on /help. */
  category: "setup" | "workflows" | "coaching";
  /** Intro paragraph(s) shown above the steps. */
  body: string[];
  /** Numbered steps. Each is a short instruction sentence. */
  steps: string[];
  /** Optional related links shown under the steps. */
  related?: Array<{ label: string; href: string }>;
};

export const HELP_GUIDES: ReadonlyArray<HelpGuide> = [
  {
    slug: "ai-followup-setup",
    title: "Set up AI follow-up for new leads",
    description:
      "Configure LeadSmart AI to reply to every new lead within 60 seconds — pick a review policy, edit a template, and you're live.",
    readTime: "3 min",
    category: "setup",
    body: [
      "AI follow-up is the heart of LeadSmart. Once it's running, every new lead — from your website, Zillow, Facebook, missed calls — gets a personalized SMS + email response within 60 seconds, even at 11pm on a Sunday.",
      "Setup is a single decision (auto-send vs require approval) plus optional template tweaks. Most agents are live in under 10 minutes.",
    ],
    steps: [
      "Open Settings → Messages and pick a Review Policy. Auto-send fires the first reply immediately; Require approval drops the draft into your inbox first.",
      "Open Templates. The prebuilt 'New buyer lead' and 'New seller lead' sequences cover most cases — review the copy and update the agent name / signature placeholder.",
      "Optional: Open Settings → Voice & Style and set how formal the AI sounds (Professional / Friendly / Direct) and how quickly it should escalate to you.",
      "Send a test lead through your form to confirm the sequence fires. Replies should land in your dashboard inbox within 60 seconds.",
      "Connect your real lead sources via Settings → Channels & Compliance (Zillow, Facebook, website forms). New leads from those sources start flowing through the same sequences automatically.",
    ],
    related: [
      { label: "How AI follow-up works (FAQ)", href: "/help/faq#ai_followup" },
      { label: "Set up missed-call text-back", href: "/help/guides/missed-call-text-back" },
    ],
  },
  {
    slug: "lead-import",
    title: "Import contacts from another CRM",
    description:
      "Bring your existing contacts and pipeline into LeadSmart via CSV — duplicate-aware, one-click rollback if anything looks wrong.",
    readTime: "4 min",
    category: "setup",
    body: [
      "If you're switching from Follow Up Boss, kvCORE, or any other CRM, you can bring your full contact list into LeadSmart in one CSV upload. The import is duplicate-aware (matched by email + phone), so re-running it after a fix-up won't double your contacts.",
      "Most agents import in a single pass; if you want to validate first, we recommend importing 10 test rows, confirming the field mapping looks right, and then running the full file.",
    ],
    steps: [
      "Export your contacts from your current CRM as a CSV. Most CRMs put this under Settings → Data → Export.",
      "In LeadSmart, open Settings → Data & Tools and click Import contacts.",
      "Upload the CSV. LeadSmart auto-detects standard columns (Name, Email, Phone, City, Notes); review the mapping for any custom fields.",
      "Run the import. Duplicates are merged into existing rows; new contacts are created with lifecycle_stage='lead'.",
      "Confirm the count on your Contacts page matches the row count of your CSV. If anything looks wrong, click Undo last import within 24 hours to roll the entire batch back.",
    ],
    related: [
      { label: "Which CRMs do you integrate with?", href: "/help/faq#integrations" },
    ],
  },
  {
    slug: "coaching-enrollment",
    title: "Manage your LeadSmart AI Coaching enrollment",
    description:
      "Enroll, opt out, or re-enroll in Producer Track and Top Producer Track from one settings panel. Auto-enrollment respects prior opt-outs.",
    readTime: "2 min",
    category: "coaching",
    body: [
      "Coaching is auto-enrolled when you upgrade to a plan that includes a program — Producer Track on Pro+, Top Producer Track on Premium and Team. You can opt out at any time, and we won't re-enroll you silently. To re-enroll later, take an explicit action from the same panel.",
    ],
    steps: [
      "Open Settings → Coaching.",
      "Each program your plan can access shows the current state: Enrolled, Eligible — not enrolled, or Opted out.",
      "To start a program, click Enroll (or Re-enroll if you opted out before). Your dashboard tasks + weekly playbooks start tracking the program's annual transaction target immediately.",
      "To stop a program, click Opt out. Optional: leave a short note about why — it helps us improve the program. We won't re-enroll you automatically after that.",
    ],
    related: [
      { label: "What is LeadSmart AI Coaching?", href: "/agent/coaching" },
      { label: "Coaching FAQ", href: "/help/faq#coaching" },
    ],
  },
  {
    slug: "bba-workflow",
    title: "Use the Buyer Broker Agreement (BBA) workflow",
    description:
      "Capture a signed BBA before tours so every showing is compensated. Track status from request to signature inside the deal record.",
    readTime: "3 min",
    category: "workflows",
    body: [
      "Post-NAR settlement, every brokerage needs a Buyer Broker Agreement signed before showing homes. LeadSmart's BBA workflow makes that a one-click step on the deal record — generate the agreement, send it for e-signature, and watch the status flip when the buyer signs.",
    ],
    steps: [
      "Open the deal (or buyer contact). In the deal sidebar, click Buyer Broker Agreement → Send for signature.",
      "Pre-fill the buyer name, agent name, commission terms (defaults pulled from Settings → Channels & Compliance → Commission defaults), and any custom clauses.",
      "Choose your e-signature provider (Dotloop or DocuSign). The agreement sends to the buyer's email immediately.",
      "Track status on the deal record. The BBA badge moves through Requested → Signed automatically when the buyer completes the signature.",
      "After signature, the deal record is unlocked for tour scheduling. Pre-signature, tour booking surfaces a soft warning so you don't accidentally show without a signed BBA.",
    ],
    related: [
      { label: "How we compare on BBA workflow", href: "/agent/compare" },
    ],
  },
  {
    slug: "video-email",
    title: "Record and send video email",
    description:
      "Send a personalized 60-second video to any lead or client without leaving LeadSmart. Track plays + completion rate inside the contact.",
    readTime: "2 min",
    category: "workflows",
    body: [
      "Video email lifts response rates significantly — buyers and sellers feel they know you before the first call. LeadSmart records and hosts video natively (no extensions, no upload step) and tracks who watched and how much.",
    ],
    steps: [
      "Open any contact and click Message → Video.",
      "Record in your browser. The first time, your browser will ask for camera + microphone permission.",
      "Trim the start/end if you want, or re-record. Most effective videos run 30–60 seconds.",
      "Add a written subject line + short message; the video embeds inline in the email body for the recipient.",
      "Click Send. You'll see a Watch event in the contact timeline when the recipient plays it, plus a percentage-watched metric so you know how engaged they are.",
    ],
    related: [
      { label: "Video email vs the rest", href: "/agent/compare" },
    ],
  },
  {
    slug: "missed-call-text-back",
    title: "Set up missed-call text-back",
    description:
      "Auto-text inbound callers when you can't pick up. Forward calls to your mobile and never lose a hot lead to voicemail again.",
    readTime: "3 min",
    category: "setup",
    body: [
      "Missed-call text-back is the highest-ROI feature for solo agents — when a caller reaches voicemail and no human, they usually call the next agent on the list. With LeadSmart, the moment a call goes unanswered, an SMS goes out automatically.",
    ],
    steps: [
      "Open Settings → Voice & Style → Missed Call Text-Back.",
      "Pick the LeadSmart number you want callers to dial. (If you don't have one yet, Settings → Channels & Compliance → Phone numbers will provision one in your area code.)",
      "Set up call forwarding from that number to your personal mobile so you can pick up live when you're available.",
      "Customize the auto-text. The default — 'Sorry I missed you! Are you calling about [property]?' — works well; agents who personalize it see noticeably higher reply rates.",
      "Ring duration: keep it short (12–15 seconds) so callers don't sit on hold. The auto-text fires within 60 seconds of the missed call.",
    ],
  },
];

/** Lookup helper for the dynamic [slug] page. */
export function getGuide(slug: string): HelpGuide | null {
  return HELP_GUIDES.find((g) => g.slug === slug) ?? null;
}

/** Convenience: group guides by category in the order they're declared. */
export function groupedGuides(): Array<{
  category: HelpGuide["category"];
  label: string;
  guides: HelpGuide[];
}> {
  const order: Array<{ id: HelpGuide["category"]; label: string }> = [
    { id: "setup", label: "Getting started" },
    { id: "workflows", label: "Deal workflows" },
    { id: "coaching", label: "Coaching" },
  ];
  return order.map((c) => ({
    category: c.id,
    label: c.label,
    guides: HELP_GUIDES.filter((g) => g.category === c.id),
  }));
}
