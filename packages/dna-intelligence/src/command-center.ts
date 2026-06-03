// The Executive Command Center read-model — its AI Workforce node. Pure: the caller
// fetches the employee directory and the daily metric rows (org-scoped), then this
// rolls them into the per-employee + org-wide KPI view the dashboard renders. Keeping
// it pure means dna-intelligence imports neither @helm/ai-workforce nor @helm/data —
// the app bridges the two Core packages.

/** Minimal employee identity the read-model needs (a projection of AiEmployee). */
export interface EmployeeRef {
  id: string;
  slug: string;
  name: string;
  role: string;
}

/** One daily metric data point (a projection of AiEmployeeMetric). */
export interface MetricPoint {
  employeeId: string;
  metricKey: string;
  metricValue: number;
}

/** A single employee's KPIs summed over the window. */
export interface EmployeeKpiSummary {
  employeeId: string;
  slug: string;
  name: string;
  role: string;
  metrics: Record<string, number>;
  /** Sum of all this employee's metric values — a rough "activity" sort key. */
  activity: number;
}

export interface WorkforceSummary {
  from: string;
  to: string;
  employees: EmployeeKpiSummary[];
  /** Org-wide totals per metric key. */
  totals: Record<string, number>;
}

/**
 * Roll daily workforce metrics up into the Command Center's AI Workforce view:
 * each employee's KPIs summed over [from, to], plus org-wide totals. Employees with
 * no metrics in the window are included with an empty KPI set (so the roster still
 * shows). Result is sorted busiest-first.
 */
export function rollUpWorkforce(
  employees: EmployeeRef[],
  metrics: MetricPoint[],
  from: string,
  to: string
): WorkforceSummary {
  const byEmployee = new Map<string, Record<string, number>>();
  const totals: Record<string, number> = {};

  for (const m of metrics) {
    const bucket = byEmployee.get(m.employeeId) ?? {};
    bucket[m.metricKey] = (bucket[m.metricKey] ?? 0) + m.metricValue;
    byEmployee.set(m.employeeId, bucket);
    totals[m.metricKey] = (totals[m.metricKey] ?? 0) + m.metricValue;
  }

  const summaries: EmployeeKpiSummary[] = employees.map((e) => {
    const metricsForEmployee = byEmployee.get(e.id) ?? {};
    const activity = Object.values(metricsForEmployee).reduce((s, v) => s + v, 0);
    return { employeeId: e.id, slug: e.slug, name: e.name, role: e.role, metrics: metricsForEmployee, activity };
  });

  summaries.sort((a, b) => b.activity - a.activity);
  return { from, to, employees: summaries, totals };
}
