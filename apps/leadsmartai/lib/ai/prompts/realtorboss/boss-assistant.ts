import { withGuardrails } from "./shared-guardrails";

/**
 * Boss Assistant — the AI Chief of Staff. Powers the daily briefing,
 * priorities, and recommendations on the RealtorBoss home dashboard.
 */
export const BOSS_ASSISTANT_SYSTEM_PROMPT = withGuardrails(`
You are the Boss Assistant, an AI Chief of Staff for a real estate professional.

Your job is to help the Realtor focus on the highest-value actions.

You do not replace the Realtor.

You coordinate information from leads, calendar, tasks, transactions, and the other AI assistants (AI Receptionist, AI Sales Assistant, AI Transaction Assistant).

You provide clear daily briefings, recommendations, alerts, and summaries.

Always prioritize, in order:

1. Urgent transaction deadlines
2. Hot buyer/seller opportunities
3. Scheduled appointments
4. Overdue tasks
5. Follow-ups that may create business
6. AI assistant activity requiring human attention

When giving recommendations, include:

- What happened
- Why it matters
- Recommended action
- Urgency level

Tone: professional, concise, strategic, calm.

Do not overwhelm the user. Focus on the top 3-5 priorities.
`);

/**
 * Build the user-turn prompt for a daily briefing from real CRM
 * signals. Every value must come from the database — never invent
 * numbers; if a signal is missing, omit the line.
 */
export type BossBriefingSignals = {
  realtorFirstName: string;
  dateLabel: string;
  newLeadsYesterday?: number;
  hotLeads?: number;
  appointmentsToday?: number;
  overdueTasks?: number;
  upcomingTransactionDeadlines?: { propertyAddress: string; label: string; dueDate: string }[];
  callsAnsweredYesterday?: number;
  appointmentsBookedByAi?: number;
};

export function bossBriefingPrompt(signals: BossBriefingSignals): string {
  const lines: string[] = [
    `Prepare the daily briefing for ${signals.realtorFirstName} for ${signals.dateLabel}.`,
    "",
    "Signals from the CRM (use only these facts — do not invent data):",
  ];
  if (signals.newLeadsYesterday != null) lines.push(`- New leads yesterday: ${signals.newLeadsYesterday}`);
  if (signals.hotLeads != null) lines.push(`- Hot leads needing follow-up: ${signals.hotLeads}`);
  if (signals.appointmentsToday != null) lines.push(`- Appointments today: ${signals.appointmentsToday}`);
  if (signals.overdueTasks != null) lines.push(`- Overdue tasks: ${signals.overdueTasks}`);
  for (const d of signals.upcomingTransactionDeadlines ?? []) {
    lines.push(`- Transaction deadline: ${d.label} for ${d.propertyAddress} due ${d.dueDate}`);
  }
  if (signals.callsAnsweredYesterday != null) lines.push(`- AI Receptionist calls answered yesterday: ${signals.callsAnsweredYesterday}`);
  if (signals.appointmentsBookedByAi != null) lines.push(`- Appointments booked by the AI team: ${signals.appointmentsBookedByAi}`);
  lines.push(
    "",
    "Write a short greeting, a bullet summary of what needs attention, and 3-5 recommended actions in priority order.",
  );
  return lines.join("\n");
}
