// Daily KPI rollup — the sanctioned source for the Executive Command Center's AI
// Workforce node. One row per (employee, day, metric_key); record sets an exact value,
// increment bumps a running daily counter.

import type { AiEmployeeMetric } from "./types";
import { type Db, rowToMetric } from "./db";

const ON_CONFLICT = "organization_id,employee_id,metric_date,metric_key";

/** UTC YYYY-MM-DD. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface MetricInput {
  employeeId: string;
  metricKey: string; // 'calls_answered' | 'appointments_booked' | 'tokens' | …
  metricValue: number;
  metricDate?: string; // YYYY-MM-DD, defaults to today (UTC)
}

/** Set a daily metric to an exact value (upsert on the daily unique key). */
export async function recordMetric(db: Db, orgId: string, input: MetricInput): Promise<void> {
  const { error } = await db.from("ai_employee_metrics").upsert(
    {
      organization_id: orgId,
      employee_id: input.employeeId,
      metric_date: input.metricDate ?? todayUtc(),
      metric_key: input.metricKey,
      metric_value: input.metricValue,
    },
    { onConflict: ON_CONFLICT }
  );
  if (error) throw new Error(error.message);
}

export interface IncrementInput {
  employeeId: string;
  metricKey: string;
  by?: number; // default 1
  metricDate?: string;
}

/**
 * Bump a daily metric by `by` (default 1), returning the new total. Read-modify-write:
 * NOT atomic under concurrency — fine for low-rate daily counters; promote to a SQL
 * increment RPC if a metric ever sees contended concurrent writes.
 */
export async function incrementMetric(db: Db, orgId: string, input: IncrementInput): Promise<number> {
  const date = input.metricDate ?? todayUtc();
  const { data: existing, error: readErr } = await db
    .from("ai_employee_metrics")
    .select("metric_value")
    .eq("organization_id", orgId)
    .eq("employee_id", input.employeeId)
    .eq("metric_date", date)
    .eq("metric_key", input.metricKey)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  const next = (existing?.metric_value ?? 0) + (input.by ?? 1);
  await recordMetric(db, orgId, {
    employeeId: input.employeeId,
    metricKey: input.metricKey,
    metricValue: next,
    metricDate: date,
  });
  return next;
}

export interface MetricQuery {
  employeeId?: string; // omit for the whole org
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

/** Daily metrics across a date range (optionally one employee), newest day first. */
export async function getMetrics(db: Db, orgId: string, q: MetricQuery): Promise<AiEmployeeMetric[]> {
  let query = db
    .from("ai_employee_metrics")
    .select("*")
    .eq("organization_id", orgId)
    .gte("metric_date", q.from)
    .lte("metric_date", q.to);
  if (q.employeeId) query = query.eq("employee_id", q.employeeId);

  const { data, error } = await query.order("metric_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToMetric);
}
