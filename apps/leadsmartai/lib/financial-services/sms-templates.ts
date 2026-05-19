/**
 * Insurance / financial-services AI SMS + email template library.
 *
 * Two purposes:
 *  1. Demo: show execs that templates exist for every key moment in their funnel.
 *  2. Day-one pilot: producers use these out of the box; compliance pre-approves
 *     templates as a batch, not per-send.
 *
 * Each template is a *seed* for the LLM, not a verbatim send. The system fills
 * `{tokens}` with prospect facts, then asks the LLM to refine for natural tone.
 *
 * COMPLIANCE: templates here are educational. State-specific disclosures and
 * carrier-mandated language are appended by the delivery system, not here.
 */

export type FsTemplateCategory =
  | "prospect_intake"
  | "appt_booking"
  | "post_fna"
  | "long_term_nurture"
  | "annual_review"
  | "recruit_invite"
  | "recruit_followup"
  | "compliance_safe";

export type FsTemplateChannel = "sms" | "email";

export type FsTemplate = {
  id: string;
  channel: FsTemplateChannel;
  category: FsTemplateCategory;
  label: string;
  description: string;
  body: string;
  tokens: string[];
};

export const FS_TEMPLATES: FsTemplate[] = [
  /* -------- Prospect intake -------- */
  {
    id: "sms_intake_thanks",
    channel: "sms",
    category: "prospect_intake",
    label: "First-touch thanks (SMS)",
    description: "Sent within 5 minutes of a new inbound prospect.",
    tokens: ["{first_name}", "{producer_first}"],
    body: `Hi {first_name}, this is {producer_first}. Got your request — thanks for reaching out. I help families build protection + retirement plans without the carrier-portal headache. When's a 15-min call easy for you, today or tomorrow?`,
  },
  {
    id: "email_intake_welcome",
    channel: "email",
    category: "prospect_intake",
    label: "Welcome + what to expect (Email)",
    description: "Educational email after a lead capture form.",
    tokens: ["{first_name}", "{producer_full}", "{agency_name}"],
    body: `Subject: Quick next steps on your financial review, {first_name}

Hi {first_name},

Thanks for the request. Here's exactly how this works so you know what to expect:

1) A short call (15 min) — you tell me about your household, your goals, and what's been on your mind.
2) I build a custom Financial Needs Analysis from your inputs (no cost, no pitch).
3) We review it together. If something fits, great. If not, you keep the analysis.

That's it. No high-pressure anything.

Reply with two times that work this week and I'll lock one.

{producer_full}
{agency_name}`,
  },

  /* -------- Appointment booking -------- */
  {
    id: "sms_appt_confirm",
    channel: "sms",
    category: "appt_booking",
    label: "Appt confirmed (SMS, day-before)",
    description: "Reduces no-show rate. Sent 24h before kitchen-table appt.",
    tokens: ["{first_name}", "{appt_time}", "{producer_first}"],
    body: `Hey {first_name}, confirming our review {appt_time}. I'll have a short Financial Needs Analysis prepped for you — about 20 min, no obligation. Bring any current life or retirement statements if handy. Reply Y to confirm, R to reschedule.`,
  },
  {
    id: "sms_appt_reminder_2h",
    channel: "sms",
    category: "appt_booking",
    label: "Appt T-2h reminder",
    description: "Final nudge; high impact on show rate.",
    tokens: ["{first_name}", "{producer_first}"],
    body: `{first_name} — heads up, our review is in 2 hours. I'll keep it tight. — {producer_first}`,
  },

  /* -------- Post-FNA / post-appointment -------- */
  {
    id: "sms_post_fna_recap",
    channel: "sms",
    category: "post_fna",
    label: "Post-FNA recap (SMS)",
    description: "Same-day after the FNA review.",
    tokens: ["{first_name}", "{producer_first}", "{coverage_amount}"],
    body: `{first_name}, sending over your FNA + the {coverage_amount} option we discussed. Take a look when you're settled tonight — I'll follow up tomorrow with the illustration once underwriting gives me a rate class. — {producer_first}`,
  },
  {
    id: "email_post_fna_followup",
    channel: "email",
    category: "post_fna",
    label: "Post-FNA email (illustration + Q&A)",
    description: "Sent after the kitchen-table appt with attached FNA.",
    tokens: ["{first_name}", "{producer_full}", "{recommended_product}", "{coverage_amount}"],
    body: `Subject: Your FNA + a few next steps, {first_name}

{first_name},

Good talking yesterday. Attached is your Financial Needs Analysis with the {coverage_amount} coverage option we discussed — designed around your dependents, income, and retirement timeline.

Here's where we left things:
- You're reviewing the recommendation ({recommended_product}) over the next few days.
- I'm requesting an illustration from the carrier so you can see month-by-month numbers.
- We'll regroup later this week to walk through it.

If anything's unclear in the analysis or you want to tweak inputs (different dependent count, different retirement age, etc.), reply and I'll re-run it.

No rush — but I want you to have the numbers in front of you.

{producer_full}`,
  },

  /* -------- Long-term nurture -------- */
  {
    id: "sms_nurture_30day",
    channel: "sms",
    category: "long_term_nurture",
    label: "30-day quiet-lead nudge",
    description: "For prospects who went cold post-FNA.",
    tokens: ["{first_name}", "{producer_first}"],
    body: `Hey {first_name} — circling back. Last we talked you were weighing a few things. Any questions I can answer fast over text? No pressure either way. — {producer_first}`,
  },
  {
    id: "email_nurture_market_update",
    channel: "email",
    category: "long_term_nurture",
    label: "Quarterly market & rates update",
    description: "Quarterly value-add to nurture cold leads.",
    tokens: ["{first_name}", "{producer_full}", "{quarter}"],
    body: `Subject: {quarter} update — what's changed for households like yours

{first_name},

Quick quarterly note — three things that matter for households running an FNA right now:

1) Interest-crediting caps on indexed products shifted again this quarter — affects the cash-value side of IUL.
2) Term life premiums for 30–45 yr olds remain at historic lows; if you've been on the fence, the window's still good.
3) Annuity rates on multi-year guaranteed products held above 5% — meaningful for the principal-protection portion of retirement.

If any of this nudges you to revisit your FNA, reply and I'll re-run it with current assumptions.

{producer_full}`,
  },

  /* -------- Annual review -------- */
  {
    id: "sms_annual_review_due",
    channel: "sms",
    category: "annual_review",
    label: "Annual review due (SMS)",
    description: "Sent 30 days before policy anniversary.",
    tokens: ["{first_name}", "{anniversary_month}", "{producer_first}"],
    body: `Hi {first_name}, your policy anniversary is coming up in {anniversary_month}. Want to do a quick 15-min annual review? I'll check beneficiaries, coverage fit vs. your current situation, and any rider opportunities. Reply Y for a few options. — {producer_first}`,
  },

  /* -------- Recruit invite -------- */
  {
    id: "sms_recruit_warm_intro",
    channel: "sms",
    category: "recruit_invite",
    label: "Warm recruit intro (SMS)",
    description: "Use when someone in your network expresses interest in joining.",
    tokens: ["{first_name}", "{producer_first}"],
    body: `{first_name} — appreciated our chat earlier. I run a financial services team and we're growing the local roster. No experience required — full training + licensing path. Want me to send a 20-min overview video, or grab time live? — {producer_first}`,
  },
  {
    id: "email_recruit_bpm_invite",
    channel: "email",
    category: "recruit_invite",
    label: "BPM invite (Email)",
    description: "Invite to a Business Presentation Meeting.",
    tokens: ["{first_name}", "{bpm_date_time}", "{bpm_location_or_zoom}", "{producer_full}"],
    body: `Subject: Quick invite — {bpm_date_time}

{first_name},

Wanted to invite you to a Business Presentation Meeting on {bpm_date_time} — it's a 45-min overview of how the financial services side of what I do works, the licensing path, and what producers actually earn at different tiers.

No pitch. No pressure. Just see if it's something you'd want to explore.

Location: {bpm_location_or_zoom}

Reply yes/no and I'll add you to the list.

{producer_full}`,
  },

  /* -------- Recruit follow-up -------- */
  {
    id: "sms_recruit_post_bpm",
    channel: "sms",
    category: "recruit_followup",
    label: "Post-BPM follow-up (SMS)",
    description: "Same-day after a BPM.",
    tokens: ["{first_name}", "{producer_first}"],
    body: `{first_name}, glad you came tonight. The next step is a 1:1 to map out what licensing + your first 90 days would look like. Got 20 min this week? Tue 6pm or Thu 11am? — {producer_first}`,
  },
  {
    id: "sms_recruit_license_nudge",
    channel: "sms",
    category: "recruit_followup",
    label: "Pre-licensing course nudge (SMS)",
    description: "For recruits who stalled mid-course.",
    tokens: ["{first_name}", "{producer_first}"],
    body: `{first_name} — checking on module 2 of pre-licensing. Most people get hung up there; happy to walk through it with you on a 15-min call. Want to grab a slot? — {producer_first}`,
  },

  /* -------- Compliance-safe boilerplate -------- */
  {
    id: "sms_optout_confirm",
    channel: "sms",
    category: "compliance_safe",
    label: "Opt-out acknowledgement (SMS)",
    description: "Auto-sent when a recipient texts STOP. Audit-logged.",
    tokens: ["{producer_first}"],
    body: `You're unsubscribed and won't receive further texts from {producer_first}. Reply START anytime to opt back in. For policyholder service questions, call your carrier directly.`,
  },
];

export function getTemplatesByCategory(category: FsTemplateCategory): FsTemplate[] {
  return FS_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByChannel(channel: FsTemplateChannel): FsTemplate[] {
  return FS_TEMPLATES.filter((t) => t.channel === channel);
}

export function findTemplate(id: string): FsTemplate | undefined {
  return FS_TEMPLATES.find((t) => t.id === id);
}
