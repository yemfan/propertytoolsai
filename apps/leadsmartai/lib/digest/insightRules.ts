import type { WeeklyMetrics, DigestInsight } from "./types";

type InsightRule = {
  key: string;
  evaluate: (m: WeeklyMetrics) => DigestInsight | null;
};

const rules: InsightRule[] = [
  // Response time
  {
    key: "response_time_fast",
    evaluate: (m) =>
      m.avg_response_time_minutes != null && m.avg_response_time_minutes <= 15
        ? {
            key: "response_time_fast",
            label: "Fast responder",
            message: `Avg response time: ${m.avg_response_time_minutes} min. Great job — fast replies close more deals.`,
            tone: "positive",
          }
        : null,
  },
  {
    key: "response_time_slow",
    evaluate: (m) =>
      m.avg_response_time_minutes != null && m.avg_response_time_minutes > 30
        ? {
            key: "response_time_slow",
            label: "Response time needs attention",
            message: `Avg response time: ${m.avg_response_time_minutes} min. Try to reply within 15 min — leads go cold fast.`,
            tone: "warning",
          }
        : null,
  },

  // Hot leads
  {
    key: "hot_leads_up",
    evaluate: (m) =>
      m.hot_leads_generated >= 3
        ? {
            key: "hot_leads_up",
            label: "Hot leads are flowing",
            message: `${m.hot_leads_generated} hot leads this week. Prioritize follow-ups to convert them.`,
            tone: "positive",
          }
        : null,
  },
  {
    key: "no_hot_leads",
    evaluate: (m) =>
      m.hot_leads_generated === 0 && m.leads_contacted > 0
        ? {
            key: "no_hot_leads",
            label: "No hot leads this week",
            message: "Consider re-engaging warm leads with a personal call or market update.",
            tone: "neutral",
          }
        : null,
  },

  // Overdue tasks
  {
    key: "overdue_tasks",
    evaluate: (m) =>
      m.overdue_tasks > 0
        ? {
            key: "overdue_tasks",
            label: `${m.overdue_tasks} overdue task${m.overdue_tasks > 1 ? "s" : ""}`,
            message: "Clear overdue tasks to keep your pipeline moving and avoid missed opportunities.",
            tone: "warning",
          }
        : null,
  },

  // Missed calls
  {
    key: "missed_calls",
    evaluate: (m) =>
      m.missed_calls_unresolved > 0
        ? {
            key: "missed_calls",
            label: `${m.missed_calls_unresolved} missed call${m.missed_calls_unresolved > 1 ? "s" : ""} unresolved`,
            message: "Return missed calls within 24 hours — callbacks convert at 2x the rate of cold outreach.",
            tone: "warning",
          }
        : null,
  },

  // Unread conversations
  {
    key: "unread_high",
    evaluate: (m) =>
      m.unread_conversations >= 5
        ? {
            key: "unread_high",
            label: `${m.unread_conversations} unread conversations`,
            message: "Catch up on unread messages. Leads expect a reply within a few hours.",
            tone: "warning",
          }
        : null,
  },

  // Low activity
  {
    key: "low_outreach",
    evaluate: (m) =>
      m.sms_sent + m.emails_sent < 5 && m.leads_contacted < 3
        ? {
            key: "low_outreach",
            label: "Low outreach this week",
            message: "Fewer than 5 messages sent. Block 30 min daily for lead follow-ups to build momentum.",
            tone: "warning",
          }
        : null,
  },

  // Strong week
  {
    key: "strong_week",
    evaluate: (m) =>
      m.tasks_completed >= 10 && m.leads_contacted >= 10
        ? {
            key: "strong_week",
            label: "Strong week",
            message: `${m.tasks_completed} tasks done and ${m.leads_contacted} leads contacted. Keep this pace going!`,
            tone: "positive",
          }
        : null,
  },

  // Appointments
  {
    key: "appointments_booked",
    evaluate: (m) =>
      m.appointments_booked >= 3
        ? {
            key: "appointments_booked",
            label: `${m.appointments_booked} appointments booked`,
            message: "Great pipeline activity. Prep talking points before each meeting to increase close rates.",
            tone: "positive",
          }
        : null,
  },

  // Zero tasks
  {
    key: "no_tasks_completed",
    evaluate: (m) =>
      m.tasks_completed === 0
        ? {
            key: "no_tasks_completed",
            label: "No tasks completed",
            message: "Start each day by completing your top 3 tasks to keep deals progressing.",
            tone: "warning",
          }
        : null,
  },
];

/**
 * Run all insight rules against weekly metrics.
 * Returns up to 5 most relevant insights, warnings first.
 */
export function generateInsights(metrics: WeeklyMetrics): DigestInsight[] {
  const all: DigestInsight[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(metrics);
    if (result) all.push(result);
  }

  // Sort: warnings first, then positives, then neutral. Cap at 5.
  const order: Record<string, number> = { warning: 0, positive: 1, neutral: 2 };
  all.sort((a, b) => (order[a.tone] ?? 2) - (order[b.tone] ?? 2));

  return all.slice(0, 5);
}
