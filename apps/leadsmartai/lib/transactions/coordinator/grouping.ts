import type {
  TransactionRow,
  TransactionStage,
  TransactionTaskRow,
} from "../types";

/**
 * Pure builders for the transaction-coordinator kanban view.
 *
 * Takes the list of in-flight transactions + ALL their tasks and produces
 * one stage column per stage. Each column contains "cards" — one per
 * transaction that has at least one INCOMPLETE task at that stage. A
 * single transaction can appear in multiple columns (typical: inspection
 * tasks open while loan tasks are also pending — parallel tracks, not
 * sequential).
 *
 * Within a column, cards sort by:
 *   1. Overdue tasks first (any incomplete task whose due_date < now)
 *   2. Then by oldest deadline (earliest due_date among incomplete tasks)
 *   3. Then by closing_date asc (deals closing soon bubble up regardless)
 *   4. Stable on transaction id (deterministic ordering)
 *
 * Lives in its own file (no `server-only`) so vitest hits the math
 * directly without supabase mocks.
 */

export const COORDINATOR_STAGE_ORDER: ReadonlyArray<TransactionStage> = [
  "contract",
  "inspection",
  "appraisal",
  "loan",
  "closing",
];

export const COORDINATOR_STAGE_LABEL: Record<TransactionStage, string> = {
  contract: "Contract",
  inspection: "Inspection",
  appraisal: "Appraisal",
  loan: "Loan",
  closing: "Closing",
};

/** Slim transaction shape — only what the kanban card displays. */
export type CoordinatorTransactionInput = Pick<
  TransactionRow,
  | "id"
  | "agent_id"
  | "transaction_type"
  | "property_address"
  | "city"
  | "state"
  | "purchase_price"
  | "status"
  | "mutual_acceptance_date"
  | "closing_date"
  | "closing_date_actual"
> & {
  /** Best-effort contact name; null when contact link is missing. */
  contact_name: string | null;
};

/** Slim task shape — what the per-stage column rolls up. */
export type CoordinatorTaskInput = Pick<
  TransactionTaskRow,
  "id" | "transaction_id" | "stage" | "title" | "due_date" | "completed_at"
>;

export type CoordinatorStageMetrics = {
  /** Tasks at this stage that are NOT completed. Drives card visibility:
   *  zero open tasks → card doesn't appear in this column. */
  openCount: number;
  /** Subset of openCount whose due_date < nowIso. */
  overdueCount: number;
  /** Earliest due_date across the OPEN tasks at this stage (may be null
   *  when none of them have a due_date set). Used for sorting + the
   *  card's deadline label. */
  earliestDue: string | null;
  /** Title of the highest-priority open task at this stage — overdue
   *  task with the oldest due_date wins, otherwise the task with the
   *  earliest upcoming due_date. Used for the card's "next up" subline. */
  nextUpTitle: string | null;
};

export type CoordinatorTransactionCard = {
  transaction: CoordinatorTransactionInput;
  /** Aggregate across ALL stages — used for badges that don't care about
   *  the current column ("3 overdue across the deal"). */
  overall: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
  };
  /** Per-stage metrics. Always has all 5 keys — empty stages have
   *  openCount = 0. */
  byStage: Record<TransactionStage, CoordinatorStageMetrics>;
};

export type CoordinatorStageColumn = {
  stage: TransactionStage;
  label: string;
  cards: CoordinatorTransactionCard[];
};

export type CoordinatorBoard = {
  columns: CoordinatorStageColumn[];
  /** Convenience aggregate over the entire board — feeds the page-level
   *  KPI strip ("4 deals · 7 overdue tasks"). */
  totals: {
    transactionCount: number;
    overdueTasksTotal: number;
    closingThisWeek: number;
  };
};

/**
 * Build the kanban from raw inputs. Pure.
 *
 *   transactions — only in-flight rows the caller wants on the board
 *                  (typically status='active' or 'pending'). Closed /
 *                  terminated rows are intentionally NOT filtered here
 *                  so the caller can decide; we just don't filter at all.
 *   tasks        — every task across every transaction in the list. Pre-
 *                  filtering by `transaction_id IN (...)` is the
 *                  service-layer's job.
 *   nowIso       — typically `new Date().toISOString().slice(0, 10)` so
 *                  the comparison is stable across a single render.
 */
export function buildCoordinatorBoard(
  transactions: ReadonlyArray<CoordinatorTransactionInput>,
  tasks: ReadonlyArray<CoordinatorTaskInput>,
  nowIso: string,
): CoordinatorBoard {
  // Group tasks by transaction id for O(1) per-transaction lookup.
  const tasksByTxn = new Map<string, CoordinatorTaskInput[]>();
  for (const t of tasks) {
    const list = tasksByTxn.get(t.transaction_id);
    if (list) list.push(t);
    else tasksByTxn.set(t.transaction_id, [t]);
  }

  const cards: CoordinatorTransactionCard[] = transactions.map((txn) => {
    const txnTasks = tasksByTxn.get(txn.id) ?? [];

    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;

    const byStage: Record<TransactionStage, CoordinatorStageMetrics> = {
      contract: emptyMetrics(),
      inspection: emptyMetrics(),
      appraisal: emptyMetrics(),
      loan: emptyMetrics(),
      closing: emptyMetrics(),
    };

    for (const t of txnTasks) {
      totalTasks += 1;
      if (t.completed_at) {
        completedTasks += 1;
        continue;
      }
      const isOverdue = t.due_date != null && t.due_date < nowIso;
      if (isOverdue) overdueTasks += 1;

      const m = byStage[t.stage];
      m.openCount += 1;
      if (isOverdue) m.overdueCount += 1;
      if (t.due_date != null) {
        if (m.earliestDue == null || t.due_date < m.earliestDue) {
          m.earliestDue = t.due_date;
        }
      }
    }

    // Pick "next up" title per stage AFTER the loop so we have full context.
    for (const stage of COORDINATOR_STAGE_ORDER) {
      const m = byStage[stage];
      if (m.openCount === 0) continue;
      m.nextUpTitle = pickNextUpTitle(txnTasks, stage, nowIso);
    }

    return {
      transaction: txn,
      overall: { totalTasks, completedTasks, overdueTasks },
      byStage,
    };
  });

  // Build columns by filtering cards down to "has open tasks at this stage"
  // and sorting per the rules in the file header.
  const columns: CoordinatorStageColumn[] = COORDINATOR_STAGE_ORDER.map((stage) => {
    const colCards = cards.filter((c) => c.byStage[stage].openCount > 0);
    colCards.sort((a, b) => compareCardsForStage(a, b, stage));
    return {
      stage,
      label: COORDINATOR_STAGE_LABEL[stage],
      cards: colCards,
    };
  });

  // Page-level totals.
  const overdueTasksTotal = cards.reduce((sum, c) => sum + c.overall.overdueTasks, 0);
  const transactionCount = transactions.length;
  const closingThisWeek = countClosingThisWeek(transactions, nowIso);

  return {
    columns,
    totals: { transactionCount, overdueTasksTotal, closingThisWeek },
  };
}

function emptyMetrics(): CoordinatorStageMetrics {
  return {
    openCount: 0,
    overdueCount: 0,
    earliestDue: null,
    nextUpTitle: null,
  };
}

/**
 * Card sort within a stage column:
 *   - overdueCount desc (most overdue first)
 *   - earliestDue asc (oldest deadline first; nulls last)
 *   - closing_date asc (closer to close first; nulls last)
 *   - transaction.id asc (stable tie-break)
 */
function compareCardsForStage(
  a: CoordinatorTransactionCard,
  b: CoordinatorTransactionCard,
  stage: TransactionStage,
): number {
  const aMetrics = a.byStage[stage];
  const bMetrics = b.byStage[stage];

  if (bMetrics.overdueCount !== aMetrics.overdueCount) {
    return bMetrics.overdueCount - aMetrics.overdueCount;
  }

  const aDue = aMetrics.earliestDue;
  const bDue = bMetrics.earliestDue;
  if (aDue !== bDue) {
    if (aDue == null) return 1;
    if (bDue == null) return -1;
    return aDue < bDue ? -1 : 1;
  }

  const aClose = a.transaction.closing_date;
  const bClose = b.transaction.closing_date;
  if (aClose !== bClose) {
    if (aClose == null) return 1;
    if (bClose == null) return -1;
    return aClose < bClose ? -1 : 1;
  }

  return a.transaction.id < b.transaction.id ? -1 : a.transaction.id > b.transaction.id ? 1 : 0;
}

/**
 * Within one stage's open tasks, pick the one to surface as "next up":
 *   - any overdue task (due_date < now) wins; among overdues, oldest first
 *   - otherwise: earliest upcoming due_date
 *   - otherwise: title of the first task in input order
 */
function pickNextUpTitle(
  allTxnTasks: ReadonlyArray<CoordinatorTaskInput>,
  stage: TransactionStage,
  nowIso: string,
): string | null {
  const stageTasks = allTxnTasks.filter(
    (t) => t.stage === stage && !t.completed_at,
  );
  if (stageTasks.length === 0) return null;

  const overdue = stageTasks.filter(
    (t) => t.due_date != null && t.due_date < nowIso,
  );
  if (overdue.length > 0) {
    const oldest = [...overdue].sort((a, b) =>
      (a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1,
    )[0];
    return oldest?.title ?? null;
  }

  const withDates = stageTasks.filter((t) => t.due_date != null);
  if (withDates.length > 0) {
    const earliest = [...withDates].sort((a, b) =>
      (a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1,
    )[0];
    return earliest?.title ?? null;
  }

  return stageTasks[0]?.title ?? null;
}

/**
 * Count transactions whose closing_date falls within the next 7 days
 * (today inclusive). Pure — caller passes nowIso.
 */
function countClosingThisWeek(
  transactions: ReadonlyArray<CoordinatorTransactionInput>,
  nowIso: string,
): number {
  const horizon = addDaysIso(nowIso, 7);
  let n = 0;
  for (const t of transactions) {
    if (!t.closing_date) continue;
    if (t.closing_date >= nowIso && t.closing_date <= horizon) n += 1;
  }
  return n;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
