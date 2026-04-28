import { describe, expect, it } from "vitest";

import {
  buildCoordinatorBoard,
  COORDINATOR_STAGE_ORDER,
  type CoordinatorTaskInput,
  type CoordinatorTransactionInput,
} from "@/lib/transactions/coordinator/grouping";
import type { TransactionStage } from "@/lib/transactions/types";

const NOW = "2026-04-27";

function txn(
  id: string,
  overrides: Partial<CoordinatorTransactionInput> = {},
): CoordinatorTransactionInput {
  return {
    id,
    agent_id: "agent-1",
    transaction_type: "buyer_rep",
    property_address: `${id} Main St`,
    city: "Austin",
    state: "TX",
    purchase_price: 500_000,
    status: "active",
    mutual_acceptance_date: "2026-04-01",
    closing_date: "2026-05-30",
    closing_date_actual: null,
    contact_name: `Buyer ${id}`,
    ...overrides,
  };
}

function task(
  id: string,
  transactionId: string,
  stage: TransactionStage,
  overrides: Partial<CoordinatorTaskInput> = {},
): CoordinatorTaskInput {
  return {
    id,
    transaction_id: transactionId,
    stage,
    title: `${stage} task ${id}`,
    due_date: null,
    completed_at: null,
    ...overrides,
  };
}

describe("buildCoordinatorBoard — column shape", () => {
  it("always returns all 5 stages in canonical order", () => {
    const out = buildCoordinatorBoard([], [], NOW);
    expect(out.columns.map((c) => c.stage)).toEqual(COORDINATOR_STAGE_ORDER);
  });

  it("empty inputs → empty columns + zero totals", () => {
    const out = buildCoordinatorBoard([], [], NOW);
    expect(out.columns.every((c) => c.cards.length === 0)).toBe(true);
    expect(out.totals).toEqual({
      transactionCount: 0,
      overdueTasksTotal: 0,
      closingThisWeek: 0,
    });
  });

  it("column has a card only when the txn has at least one OPEN task at that stage", () => {
    const t = txn("t1");
    const tasks = [
      task("k1", "t1", "inspection"),
      task("k2", "t1", "loan", { completed_at: "2026-04-20" }),
    ];
    const out = buildCoordinatorBoard([t], tasks, NOW);
    const inspection = out.columns.find((c) => c.stage === "inspection")!;
    const loan = out.columns.find((c) => c.stage === "loan")!;
    expect(inspection.cards).toHaveLength(1);
    expect(loan.cards).toHaveLength(0); // only completed → no card
  });

  it("a transaction CAN appear in multiple columns (parallel tracks)", () => {
    const t = txn("t1");
    const tasks = [
      task("k1", "t1", "inspection"),
      task("k2", "t1", "loan"),
    ];
    const out = buildCoordinatorBoard([t], tasks, NOW);
    const stagesWithT1 = out.columns
      .filter((c) => c.cards.some((card) => card.transaction.id === "t1"))
      .map((c) => c.stage);
    expect(stagesWithT1.sort()).toEqual(["inspection", "loan"]);
  });
});

describe("buildCoordinatorBoard — overall counts", () => {
  it("sums total / completed / overdue across all stages", () => {
    const t = txn("t1");
    const tasks = [
      task("k1", "t1", "contract", { completed_at: "2026-04-20" }),
      task("k2", "t1", "inspection", { due_date: "2026-04-15" }), // overdue
      task("k3", "t1", "appraisal"),
      task("k4", "t1", "loan", { due_date: "2026-05-30" }), // future
    ];
    const out = buildCoordinatorBoard([t], tasks, NOW);
    const card = out.columns
      .flatMap((c) => c.cards)
      .find((c) => c.transaction.id === "t1")!;
    expect(card.overall).toEqual({
      totalTasks: 4,
      completedTasks: 1,
      overdueTasks: 1,
    });
  });

  it("totals.overdueTasksTotal sums across cards", () => {
    const tasks = [
      task("k1", "t1", "inspection", { due_date: "2026-04-10" }),
      task("k2", "t2", "loan", { due_date: "2026-04-15" }),
      task("k3", "t2", "appraisal", { due_date: "2026-05-30" }), // not overdue
    ];
    const out = buildCoordinatorBoard([txn("t1"), txn("t2")], tasks, NOW);
    expect(out.totals.overdueTasksTotal).toBe(2);
  });

  it("totals.closingThisWeek counts deals with closing_date in the next 7 days", () => {
    const out = buildCoordinatorBoard(
      [
        txn("t1", { closing_date: "2026-04-28" }), // tomorrow
        txn("t2", { closing_date: "2026-05-04" }), // day 7
        txn("t3", { closing_date: "2026-05-15" }), // outside window
        txn("t4", { closing_date: null }),
      ],
      [],
      NOW,
    );
    expect(out.totals.closingThisWeek).toBe(2);
  });
});

describe("buildCoordinatorBoard — per-stage metrics", () => {
  it("tracks earliestDue across open tasks at the stage", () => {
    const tasks = [
      task("k1", "t1", "inspection", { due_date: "2026-05-10" }),
      task("k2", "t1", "inspection", { due_date: "2026-04-30" }),
      task("k3", "t1", "inspection", { due_date: "2026-05-15" }),
    ];
    const out = buildCoordinatorBoard([txn("t1")], tasks, NOW);
    const card = out.columns.find((c) => c.stage === "inspection")!.cards[0];
    expect(card.byStage.inspection.earliestDue).toBe("2026-04-30");
  });

  it("ignores completed tasks when computing earliestDue", () => {
    const tasks = [
      task("k1", "t1", "inspection", {
        due_date: "2026-04-10",
        completed_at: "2026-04-09",
      }),
      task("k2", "t1", "inspection", { due_date: "2026-05-10" }),
    ];
    const out = buildCoordinatorBoard([txn("t1")], tasks, NOW);
    const card = out.columns.find((c) => c.stage === "inspection")!.cards[0];
    expect(card.byStage.inspection.earliestDue).toBe("2026-05-10");
  });

  it("nextUpTitle picks an overdue task when one exists, oldest first", () => {
    const tasks = [
      task("k1", "t1", "inspection", {
        title: "Schedule inspection",
        due_date: "2026-05-10", // future
      }),
      task("k2", "t1", "inspection", {
        title: "Confirm inspector",
        due_date: "2026-04-15", // overdue
      }),
      task("k3", "t1", "inspection", {
        title: "Send report request",
        due_date: "2026-04-10", // overdue, OLDEST
      }),
    ];
    const out = buildCoordinatorBoard([txn("t1")], tasks, NOW);
    const card = out.columns.find((c) => c.stage === "inspection")!.cards[0];
    expect(card.byStage.inspection.nextUpTitle).toBe("Send report request");
  });

  it("nextUpTitle falls back to earliest upcoming when nothing's overdue", () => {
    const tasks = [
      task("k1", "t1", "loan", {
        title: "Submit application",
        due_date: "2026-05-15",
      }),
      task("k2", "t1", "loan", {
        title: "Provide income docs",
        due_date: "2026-05-05",
      }),
    ];
    const out = buildCoordinatorBoard([txn("t1")], tasks, NOW);
    const card = out.columns.find((c) => c.stage === "loan")!.cards[0];
    expect(card.byStage.loan.nextUpTitle).toBe("Provide income docs");
  });

  it("nextUpTitle falls back to first input order when no due_dates set", () => {
    const tasks = [
      task("k1", "t1", "appraisal", { title: "First (input order)" }),
      task("k2", "t1", "appraisal", { title: "Second (input order)" }),
    ];
    const out = buildCoordinatorBoard([txn("t1")], tasks, NOW);
    const card = out.columns.find((c) => c.stage === "appraisal")!.cards[0];
    expect(card.byStage.appraisal.nextUpTitle).toBe("First (input order)");
  });
});

describe("buildCoordinatorBoard — sort order within a column", () => {
  it("overdue cards bubble to the top", () => {
    const tasks = [
      task("k1", "t1", "loan", { due_date: "2026-05-10" }), // future
      task("k2", "t2", "loan", { due_date: "2026-04-15" }), // overdue
      task("k3", "t3", "loan", { due_date: "2026-04-10" }), // more overdue
    ];
    const out = buildCoordinatorBoard(
      [txn("t1"), txn("t2"), txn("t3")],
      tasks,
      NOW,
    );
    const loan = out.columns.find((c) => c.stage === "loan")!;
    // t2, t3 overdue (sort by overdueCount desc which ties at 1, fall through
    //   to earliestDue asc → t3 has older date, t3 first); t1 future last.
    expect(loan.cards.map((c) => c.transaction.id)).toEqual(["t3", "t2", "t1"]);
  });

  it("nulls-last for earliestDue + closing_date in the sort", () => {
    const tasks = [
      task("k1", "t1", "loan"), // no due date
      task("k2", "t2", "loan", { due_date: "2026-05-15" }), // future
    ];
    const out = buildCoordinatorBoard(
      [
        txn("t1", { closing_date: null }),
        txn("t2", { closing_date: "2026-05-30" }),
      ],
      tasks,
      NOW,
    );
    const loan = out.columns.find((c) => c.stage === "loan")!;
    expect(loan.cards.map((c) => c.transaction.id)).toEqual(["t2", "t1"]);
  });

  it("stable on transaction id when all sort keys tie", () => {
    const tasks = [
      task("k1", "tA", "loan"),
      task("k2", "tB", "loan"),
    ];
    const out = buildCoordinatorBoard(
      [
        txn("tB", { closing_date: null }),
        txn("tA", { closing_date: null }),
      ],
      tasks,
      NOW,
    );
    const loan = out.columns.find((c) => c.stage === "loan")!;
    expect(loan.cards.map((c) => c.transaction.id)).toEqual(["tA", "tB"]);
  });
});

describe("buildCoordinatorBoard — defensive", () => {
  it("ignores tasks whose transaction_id isn't in the transaction list", () => {
    const tasks = [
      task("k1", "t1", "loan"),
      task("k2", "ghost", "loan"), // dangling
    ];
    const out = buildCoordinatorBoard([txn("t1")], tasks, NOW);
    const loan = out.columns.find((c) => c.stage === "loan")!;
    expect(loan.cards).toHaveLength(1);
    expect(loan.cards[0].transaction.id).toBe("t1");
  });

  it("transaction with no tasks at all → does not appear in any column", () => {
    const out = buildCoordinatorBoard([txn("t1")], [], NOW);
    expect(out.columns.every((c) => c.cards.length === 0)).toBe(true);
    expect(out.totals.transactionCount).toBe(1);
  });
});
