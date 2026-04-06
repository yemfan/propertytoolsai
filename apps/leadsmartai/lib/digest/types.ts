/** Weekly performance metrics computed per agent. */
export type WeeklyMetrics = {
  leads_contacted: number;
  sms_sent: number;
  emails_sent: number;
  calls_logged: number;
  tasks_completed: number;
  appointments_booked: number;
  hot_leads_generated: number;
  avg_response_time_minutes: number | null;
  missed_calls_unresolved: number;
  overdue_tasks: number;
  unread_conversations: number;
};

/** A single coaching insight derived from metrics. */
export type DigestInsight = {
  /** e.g. "response_time_slow", "hot_leads_up", "overdue_tasks" */
  key: string;
  /** Short label: "Slow response time" */
  label: string;
  /** Actionable message: "Your avg response time is 45 min. Try to reply within 15 min." */
  message: string;
  /** positive | warning | neutral */
  tone: "positive" | "warning" | "neutral";
};

/** Full digest payload stored in performance_digests.payload_json. */
export type DigestPayload = {
  metrics: WeeklyMetrics;
  insights: DigestInsight[];
  week_start: string;
  week_end: string;
  agent_id: string;
};

/** Row shape from the performance_digests table. */
export type PerformanceDigestRow = {
  id: string;
  agent_id: string;
  week_start: string;
  week_end: string;
  title: string;
  body: string;
  metrics: WeeklyMetrics;
  insights: DigestInsight[];
  payload_json: DigestPayload;
  push_sent_at: string | null;
  created_at: string;
};
