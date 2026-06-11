/**
 * RealtorBoss skill library — modular skills attachable to assistants.
 *
 * Phase 1: skills are typed prompt fragments. Phase 2 will promote
 * them to DB-backed `ai_skills` rows with config schemas (HelmSmart
 * `@helm/ai-workforce` tool pattern) — keep keys stable so the
 * migration is a data copy, not a rename.
 */

export type SkillCategory =
  | "reception"
  | "qualification"
  | "scheduling"
  | "conversion"
  | "transaction";

export type Skill = {
  key: string;
  name: string;
  description: string;
  category: SkillCategory;
  /** Prompt fragment appended to the owning assistant's system prompt. */
  prompt: string;
};

export const SKILLS: readonly Skill[] = [
  {
    key: "lead_capture",
    name: "Lead Capture",
    description: "Capture required contact info and create/update the lead record.",
    category: "reception",
    prompt: `When speaking with a new contact, capture: name, phone, email, source, and buyer/seller intent. Create or update the lead record with everything you learn.`,
  },
  {
    key: "buyer_qualification",
    name: "Buyer Qualification",
    description: "Determine buyer readiness and lead temperature.",
    category: "qualification",
    prompt: `For buyers, learn: desired area, budget, property type, timeline, pre-approval status, and current housing situation. Classify lead temperature as hot, warm, or cold based on timeline and financing readiness.`,
  },
  {
    key: "seller_qualification",
    name: "Seller Qualification",
    description: "Determine seller opportunity and lead temperature.",
    category: "qualification",
    prompt: `For sellers, learn: property address, property type, timeline, motivation, desired price if offered, and whether they want a home valuation. Classify lead temperature as hot, warm, or cold.`,
  },
  {
    key: "appointment_scheduling",
    name: "Appointment Scheduling",
    description: "Book consultations, showings, listing appointments, or demos.",
    category: "scheduling",
    prompt: `When booking an appointment, confirm: appointment type, date and time, timezone, attendees, and location or meeting method. Repeat the details back to confirm before booking.`,
  },
  {
    key: "faq",
    name: "FAQ",
    description: "Answer approved business FAQs from the knowledge base.",
    category: "reception",
    prompt: `Answer questions only from the approved business knowledge base. If the answer is not in the knowledge base, say you will have the Realtor follow up, and log the question.`,
  },
  {
    key: "transfer",
    name: "Transfer / Escalation",
    description: "Transfer or escalate urgent calls to the Realtor.",
    category: "reception",
    prompt: `Escalate to the Realtor when: the caller asks for a human, there is a transaction emergency, a legal or contract issue, a complaint, an active client issue, a ready-to-list seller, or a ready-to-offer buyer.`,
  },
  {
    key: "speed_to_lead",
    name: "Speed-to-Lead",
    description: "Contact new leads immediately and attempt appointment booking.",
    category: "conversion",
    prompt: `Contact brand-new leads as quickly as possible. Reference what they inquired about, be helpful first, and attempt to book an appointment when interest is confirmed.`,
  },
  {
    key: "follow_up",
    name: "Follow-Up",
    description: "Follow up with leads on an appropriate cadence.",
    category: "conversion",
    prompt: `Follow up with unresponsive leads using a respectful cadence. Vary the message, add value each time (new listings, market info), and avoid spammy or pushy language.`,
  },
  {
    key: "reactivation",
    name: "Lead Reactivation",
    description: "Warmly reconnect with old leads.",
    category: "conversion",
    prompt: `When reconnecting with an old lead, use a warm check-in tone. Example: "Hi John, this is the assistant from Michael's real estate team. We spoke a while back about buying a home. I just wanted to check whether you're still considering a move this year."`,
  },
  {
    key: "objection_handling",
    name: "Objection Handling",
    description: "Handle common objections calmly.",
    category: "conversion",
    prompt: `Handle objections calmly and without pressure. Common ones: "I'm just looking", "I'm not ready yet", "I already have an agent", "I need to talk to my spouse", "Prices are too high", "Interest rates are too high". Acknowledge, add a helpful fact, and offer a low-commitment next step.`,
  },
  {
    key: "transaction_deadlines",
    name: "Transaction Deadline Tracking",
    description: "Track important transaction dates and create alerts.",
    category: "transaction",
    prompt: `Track inspection, appraisal, loan-contingency, and closing dates. Surface anything due within 7 days, and flag anything overdue as high risk.`,
  },
  {
    key: "document_reminders",
    name: "Document Reminders",
    description: "Remind the Realtor or client about missing documents.",
    category: "transaction",
    prompt: `When a checklist task or document is missing or overdue, remind the Realtor with the property address, what is missing, and the deadline it blocks.`,
  },
] as const;

export function getSkill(key: string): Skill | undefined {
  return SKILLS.find((s) => s.key === key);
}

/** Compose the prompt fragments for a set of skill keys. */
export function skillPrompts(keys: readonly string[]): string {
  return keys
    .map((k) => getSkill(k))
    .filter((s): s is Skill => Boolean(s))
    .map((s) => `### ${s.name}\n${s.prompt}`)
    .join("\n\n");
}
