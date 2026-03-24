import { anyTimestampInRange, parseDateRangeQuery } from "@/lib/dashboard/dateRange";
import {
  LOAN_APPLICATIONS_BROKER_COLUMN,
  LOAN_APPLICATIONS_SELECT,
  LOAN_APPLICATIONS_SELECT_WITHOUT_CREATED_AT,
  LOAN_APPLICATIONS_TABLE,
} from "@/lib/dashboard/schemaConfig";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LoanBrokerDashboardResponse = {
  kpis: {
    newFinancingLeads: number;
    preQualified: number;
    applicationsInProgress: number;
    docsPending: number;
    fundedThisMonth: number;
  };
  borrowers: Array<{
    id: string;
    name: string;
    loanAmount: number;
    readiness: string;
    status: string;
  }>;
  pipeline: Array<{
    stage: string;
    count: number;
  }>;
  missingDocs: string[];
  recentActivity: string[];
  trends: {
    applicationsByDay: Array<{ label: string; value: number }>;
    pipelineBreakdown: Array<{ label: string; value: number }>;
  };
};

/** Row shape for `loan_applications` (extend as your schema evolves). */
export type LoanApplicationRow = {
  id: string | number;
  status?: string | null;
  borrower_name?: string | null;
  loan_amount?: number | null;
  readiness?: string | null;
  docs_pending_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function emptyLoanBrokerDashboardResponse(): LoanBrokerDashboardResponse {
  return {
    kpis: {
      newFinancingLeads: 0,
      preQualified: 0,
      applicationsInProgress: 0,
      docsPending: 0,
      fundedThisMonth: 0,
    },
    borrowers: [],
    pipeline: [
      { stage: "Inquiry", count: 0 },
      { stage: "Pre-Qual", count: 0 },
      { stage: "Application", count: 0 },
      { stage: "Docs", count: 0 },
      { stage: "Underwriting", count: 0 },
      { stage: "Funded", count: 0 },
    ],
    missingDocs: [],
    recentActivity: [],
    trends: {
      applicationsByDay: [],
      pipelineBreakdown: [],
    },
  };
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function hasCreatedAtFilter(start?: string, end?: string): boolean {
  return Boolean(start?.trim() || end?.trim());
}

function statusOf(r: LoanApplicationRow): string {
  return String(r.status ?? "").toLowerCase();
}

function pendingDocsCount(r: LoanApplicationRow): number {
  const n = r.docs_pending_count;
  return typeof n === "number" && Number.isFinite(n) ? n : Number(n ?? 0) || 0;
}

function applicationDayKey(r: LoanApplicationRow): string | null {
  const iso = r.created_at ?? r.updated_at;
  if (typeof iso !== "string" || iso.length < 10) return null;
  return iso.slice(0, 10);
}

function isMissingCreatedAtError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  const code = String(error.code ?? "");
  if (!msg.includes("created_at")) return false;
  if (msg.includes("does not exist") || msg.includes("undefined column")) return true;
  if (code === "42703") return true;
  return false;
}

/**
 * Prefer `loan_brokers.id` when that table exists; otherwise use auth user id
 * (if `assigned_broker_id` stores the Supabase user UUID).
 */
export async function resolveLoanBrokerIdForUser(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from("loan_brokers").select("id").eq("auth_user_id", userId).maybeSingle();

  if (error) {
    if ((error as { code?: string }).code !== "PGRST116" && (error as { code?: string }).code !== "42P01") {
      console.warn("[resolveLoanBrokerIdForUser] loan_brokers", error.message);
    }
    return userId;
  }

  if (data?.id != null) return String(data.id);
  return userId;
}

/**
 * Loan broker dashboard. Filters `LOAN_APPLICATIONS_TABLE` by `LOAN_APPLICATIONS_BROKER_COLUMN`
 * (see `schemaConfig.ts`). Optional `start` / `end` (`YYYY-MM-DD`) filter by `created_at` in the database.
 * If `created_at` is missing on the table, falls back to a slimmer select and filters by `updated_at` in memory.
 */
export async function getLoanBrokerDashboardOverview({
  brokerId,
  start,
  end,
}: {
  brokerId: string;
  start?: string;
  end?: string;
}): Promise<LoanBrokerDashboardResponse> {
  const s = start?.trim();
  const e = end?.trim();

  let query = supabaseAdmin
    .from(LOAN_APPLICATIONS_TABLE)
    .select(LOAN_APPLICATIONS_SELECT)
    .eq(LOAN_APPLICATIONS_BROKER_COLUMN, brokerId);
  if (s) query = query.gte("created_at", `${s}T00:00:00.000Z`);
  if (e) query = query.lte("created_at", `${e}T23:59:59.999Z`);

  const { data: applications, error } = await query;

  let rows: LoanApplicationRow[];

  if (error) {
    if (!isMissingCreatedAtError(error)) {
      console.warn(`[getLoanBrokerDashboardOverview] ${LOAN_APPLICATIONS_TABLE}`, error.message);
      return emptyLoanBrokerDashboardResponse();
    }

    console.warn(
      `[getLoanBrokerDashboardOverview] ${LOAN_APPLICATIONS_TABLE} — no created_at, using legacy select + in-memory date filter`,
      error.message
    );

    const { data: legacyRows, error: legacyError } = await supabaseAdmin
      .from(LOAN_APPLICATIONS_TABLE)
      .select(LOAN_APPLICATIONS_SELECT_WITHOUT_CREATED_AT)
      .eq(LOAN_APPLICATIONS_BROKER_COLUMN, brokerId);

    if (legacyError) {
      console.warn(`[getLoanBrokerDashboardOverview] ${LOAN_APPLICATIONS_TABLE}`, legacyError.message);
      return emptyLoanBrokerDashboardResponse();
    }

    rows = (legacyRows ?? []) as LoanApplicationRow[];
    const range = parseDateRangeQuery(start, end);
    if (range) {
      rows = rows.filter((r) => anyTimestampInRange([r.updated_at], range));
    }
  } else {
    rows = (applications ?? []) as LoanApplicationRow[];
  }
  const monthStart = monthStartIso();
  const dateFiltered = hasCreatedAtFilter(start, end);

  const newFinancingLeads = rows.filter((r) => statusOf(r) === "new_inquiry").length;
  const preQualified = rows.filter((r) => statusOf(r) === "pre_qualified").length;
  const applicationsInProgress = rows.filter((r) =>
    ["application_started", "docs_submitted", "underwriting"].includes(statusOf(r))
  ).length;
  const docsPending = rows.filter((r) => pendingDocsCount(r) > 0).length;
  const fundedThisMonth = rows.filter((r) => {
    if (statusOf(r) !== "funded") return false;
    if (dateFiltered) return true;
    return Boolean(r.updated_at && String(r.updated_at) >= monthStart);
  }).length;

  const borrowers = rows.slice(0, 8).map((r) => ({
    id: String(r.id),
    name: r.borrower_name || "Unknown Borrower",
    loanAmount: r.loan_amount || 0,
    readiness: r.readiness || "Unknown",
    status: r.status || "new_inquiry",
  }));

  const pipeline = [
    { stage: "Inquiry", count: rows.filter((r) => statusOf(r) === "new_inquiry").length },
    { stage: "Pre-Qual", count: rows.filter((r) => statusOf(r) === "pre_qualified").length },
    { stage: "Application", count: rows.filter((r) => statusOf(r) === "application_started").length },
    { stage: "Docs", count: rows.filter((r) => statusOf(r) === "docs_submitted").length },
    { stage: "Underwriting", count: rows.filter((r) => statusOf(r) === "underwriting").length },
    { stage: "Funded", count: rows.filter((r) => statusOf(r) === "funded").length },
  ];

  const applicationsByDayMap = new Map<string, number>();
  for (const row of rows) {
    const dayKey = applicationDayKey(row);
    if (!dayKey) continue;
    applicationsByDayMap.set(dayKey, (applicationsByDayMap.get(dayKey) || 0) + 1);
  }
  const applicationsByDay = Array.from(applicationsByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, value]) => ({
      label: dayKey.slice(5),
      value,
    }));

  const pipelineBreakdown = pipeline.map((p) => ({
    label: p.stage,
    value: p.count,
  }));

  const missingDocs = rows
    .filter((r) => pendingDocsCount(r) > 0)
    .slice(0, 5)
    .map(
      (r) =>
        `${r.borrower_name || "Borrower"} — ${pendingDocsCount(r)} document(s) pending`
    );

  const recentActivity = rows
    .filter((r) => r.updated_at)
    .sort(
      (a, b) =>
        new Date(String(b.updated_at)).getTime() - new Date(String(a.updated_at)).getTime()
    )
    .slice(0, 5)
    .map(
      (r) =>
        `${r.borrower_name || "Borrower"} moved to ${r.status || "updated status"}`
    );

  return {
    kpis: {
      newFinancingLeads,
      preQualified,
      applicationsInProgress,
      docsPending,
      fundedThisMonth,
    },
    borrowers,
    pipeline,
    missingDocs,
    recentActivity,
    trends: {
      applicationsByDay,
      pipelineBreakdown,
    },
  };
}
