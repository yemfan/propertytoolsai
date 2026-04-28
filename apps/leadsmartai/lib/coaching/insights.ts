/**
 * Pure coaching-insight builders.
 *
 * Each function takes already-computed numbers (counts, averages, etc.)
 * and decides whether to surface a coaching nudge for the agent. Returns
 * either a `CoachingInsight` or `null` when nothing's worth flagging.
 *
 * The service layer (lib/coaching/service.ts) handles DB queries +
 * threshold tuning; everything here is data → judgment + copy. Lives in
 * its own file (no `server-only`) so vitest can hit each builder
 * without spinning up Supabase.
 *
 * The dashboard renders insights in priority order — `crit` > `warn` >
 * `info`. Within a severity, callers control the order of the array
 * they pass to the panel.
 */

export type InsightSeverity = "info" | "warn" | "crit";

export type CoachingInsight = {
  /** Stable identifier for the insight type. The UI uses this for
   *  React keys and dismiss-state in localStorage if we add it later. */
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  /** Optional headline metric. Rendered prominently. */
  metric?: { value: string; label: string };
  /** Optional click-through. Lives as a relative path (Next.js Link). */
  cta?: { href: string; label: string };
};

// ── 1. Stale past-clients (sphere dormancy) ─────────────────────────

export type StaleContactsInput = {
  /** Past clients / sphere contacts whose last_activity_at is older
   *  than `thresholdDays`. */
  staleCount: number;
  /** Days since the oldest stale contact's last touch. Used in copy. */
  oldestDays: number;
  /** Threshold day-count used for the query. */
  thresholdDays: number;
  /** Total past-client + sphere cohort size — used to gauge severity
   *  ("you've gone N days on 8 of 100 contacts" is fine; "8 of 12" is
   *  not). */
  cohortSize: number;
};

export function buildStaleContactsInsight(
  input: StaleContactsInput,
): CoachingInsight | null {
  if (input.staleCount <= 0) return null;

  const ratio = input.cohortSize > 0 ? input.staleCount / input.cohortSize : 0;
  const severity: InsightSeverity = ratio >= 0.5 ? "crit" : ratio >= 0.2 ? "warn" : "info";

  return {
    id: "stale_contacts",
    severity,
    title: "Past clients going cold",
    description:
      input.staleCount === 1
        ? `1 past client / sphere contact hasn't heard from you in ${input.thresholdDays}+ days.`
        : `${input.staleCount} past client/sphere contacts haven't heard from you in ${input.thresholdDays}+ days. Oldest: ${input.oldestDays} days.`,
    metric: { value: String(input.staleCount), label: "stale contacts" },
    cta: {
      href: "/dashboard/contacts?filter=stale",
      label: "Open stale list",
    },
  };
}

// ── 2. Response time vs. benchmark ──────────────────────────────────

export type ResponseTimeInput = {
  /** Agent's avg first-response time in minutes (from contact created
   *  to first outbound message). Null when no data yet. */
  avgMinutes: number | null;
  /** Hardcoded benchmark in minutes — top quartile based on industry
   *  data. We use 5 minutes as the "speed-to-lead" target. */
  benchmarkMinutes: number;
};

export function buildResponseTimeInsight(
  input: ResponseTimeInput,
): CoachingInsight | null {
  if (input.avgMinutes == null) return null;

  // Within 1.5x of benchmark = info (positive nudge).
  // 1.5–4x = warn (room to improve).
  // 4x+ = crit (most leads gone cold by then).
  const ratio = input.avgMinutes / input.benchmarkMinutes;
  if (ratio < 1.0) {
    return {
      id: "response_time",
      severity: "info",
      title: "Response time on point",
      description: `Your first-response time averages ${input.avgMinutes}m — ahead of the ${input.benchmarkMinutes}-minute speed-to-lead target.`,
      metric: { value: `${input.avgMinutes}m`, label: "avg response" },
    };
  }

  const severity: InsightSeverity = ratio >= 4 ? "crit" : ratio >= 1.5 ? "warn" : "info";
  return {
    id: "response_time",
    severity,
    title: "Slow first response",
    description:
      severity === "crit"
        ? `Your first-response time averages ${input.avgMinutes}m — most hot leads have gone elsewhere by then. Industry top-quartile is ${input.benchmarkMinutes}m.`
        : `Your first-response time averages ${input.avgMinutes}m. Top quartile is ${input.benchmarkMinutes}m. Faster first replies convert ~3x better.`,
    metric: { value: `${input.avgMinutes}m`, label: "avg response" },
    cta: { href: "/dashboard/performance", label: "View performance" },
  };
}

// ── 3. Sphere drip health ───────────────────────────────────────────

export type DripHealthInput = {
  activeCount: number;
  exitedCount: number;
  completedCount: number;
  /** New enrollments in the last 7 days. */
  enrolledLastWeek: number;
};

export function buildDripHealthInsight(
  input: DripHealthInput,
): CoachingInsight | null {
  // Surface when activity is non-trivial. Empty drip = no insight (not
  // a coaching opportunity, just a state).
  const total = input.activeCount + input.exitedCount + input.completedCount;
  if (total === 0) return null;

  // Critical: high exit rate signals contacts opting out / dropping
  // from both_high — could mean stale data OR over-aggressive cadence.
  const exitRate = total > 0 ? input.exitedCount / total : 0;
  if (exitRate >= 0.4 && input.exitedCount >= 5) {
    return {
      id: "drip_health",
      severity: "warn",
      title: "Drip exit rate elevated",
      description: `${input.exitedCount} of ${total} drip enrollments have exited — ${(exitRate * 100).toFixed(0)}% of the cohort. Worth checking if contacts are opting out of SMS or moving out of both_high.`,
      metric: { value: `${(exitRate * 100).toFixed(0)}%`, label: "exit rate" },
      cta: { href: "/dashboard/sphere/monetization", label: "Review cohort" },
    };
  }

  // Positive note: agent has steady enrollment + completions.
  if (input.activeCount > 0) {
    return {
      id: "drip_health",
      severity: "info",
      title: "Sphere drip in motion",
      description: `${input.activeCount} active drip enrollment${input.activeCount === 1 ? "" : "s"}${
        input.enrolledLastWeek > 0
          ? ` · ${input.enrolledLastWeek} new this week`
          : ""
      }${
        input.completedCount > 0
          ? ` · ${input.completedCount} completed cadence`
          : ""
      }.`,
      metric: { value: String(input.activeCount), label: "active drips" },
      cta: { href: "/dashboard/sphere/monetization", label: "View sphere" },
    };
  }

  return null;
}

// ── 4. Past-due in-flight commission ───────────────────────────────

export type PastDueCommissionInput = {
  pastDueCount: number;
  /** Sum of gross_commission for past-due active deals. */
  pastDueGross: number;
};

export function buildPastDueCommissionInsight(
  input: PastDueCommissionInput,
): CoachingInsight | null {
  if (input.pastDueCount <= 0) return null;

  return {
    id: "past_due_commission",
    severity: "warn",
    title: "In-flight deals past their close date",
    description:
      input.pastDueCount === 1
        ? `1 active transaction is past its scheduled close. Gross commission at risk: ${formatMoney(input.pastDueGross)}.`
        : `${input.pastDueCount} active transactions are past their scheduled close. Combined gross at risk: ${formatMoney(input.pastDueGross)}.`,
    metric: {
      value: formatMoney(input.pastDueGross),
      label: "at-risk gross",
    },
    cta: {
      href: "/dashboard/performance",
      label: "Open pipeline forecast",
    },
  };
}

// ── 5. Unreplied hot leads ──────────────────────────────────────────

export type UnrepliedHotLeadsInput = {
  /** Count of contacts with rating='hot' created in the last `hours`
   *  with no outbound message. */
  count: number;
  hours: number;
};

export function buildUnrepliedHotLeadsInsight(
  input: UnrepliedHotLeadsInput,
): CoachingInsight | null {
  if (input.count <= 0) return null;

  const severity: InsightSeverity = input.count >= 3 ? "crit" : "warn";
  return {
    id: "unreplied_hot_leads",
    severity,
    title: "Hot leads waiting for a reply",
    description:
      input.count === 1
        ? `1 hot lead came in within the last ${input.hours} hours and hasn't received an outbound message.`
        : `${input.count} hot leads came in within the last ${input.hours} hours and haven't received an outbound message.`,
    metric: { value: String(input.count), label: "hot leads waiting" },
    cta: {
      href: "/dashboard/leads?filter=hot_unreplied",
      label: "Open hot inbox",
    },
  };
}

// ── Sort helpers ───────────────────────────────────────────────────

/**
 * Sort insights by severity desc (crit > warn > info), then by their
 * order in the input. Stable for ties so callers can control fallback
 * ordering by ordering their builder calls.
 */
export function sortInsightsBySeverity(
  insights: ReadonlyArray<CoachingInsight>,
): CoachingInsight[] {
  const order: Record<InsightSeverity, number> = { crit: 0, warn: 1, info: 2 };
  return [...insights]
    .map((insight, index) => ({ insight, index }))
    .sort((a, b) => {
      const sevDiff = order[a.insight.severity] - order[b.insight.severity];
      if (sevDiff !== 0) return sevDiff;
      return a.index - b.index;
    })
    .map((x) => x.insight);
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
