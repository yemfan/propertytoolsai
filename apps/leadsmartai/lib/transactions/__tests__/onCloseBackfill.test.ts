import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionRow } from "../types";

// `onCloseBackfill` imports `server-only`, which throws when loaded
// outside a React Server Components context. Stub it to a no-op so the
// module loads in a plain-node vitest run.
vi.mock("server-only", () => ({}));

// Mock the supabase admin module so we can capture the update payload
// without hitting a real DB. Declaring the mock as a hoisted factory is
// the idiomatic vitest pattern for module-level replacement.
const updateMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updateMock(payload);
        return {
          eq: () => Promise.resolve({ data: null, error: null }),
        };
      },
    }),
  },
}));

// Import AFTER the mock so the helper picks up the stubbed client.
// eslint-disable-next-line import/first
import { applyOnCloseBackfill } from "../onCloseBackfill";

function baseRow(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: "tx-1",
    agent_id: "agent-1",
    contact_id: "c-1",
    transaction_type: "buyer_rep",
    property_address: "500 Sutter St",
    city: null,
    state: null,
    zip: null,
    purchase_price: 1_200_000,
    status: "closed",
    terminated_reason: null,
    mutual_acceptance_date: "2026-03-01",
    inspection_deadline: null,
    inspection_completed_at: null,
    appraisal_deadline: null,
    appraisal_completed_at: null,
    loan_contingency_deadline: null,
    loan_contingency_removed_at: null,
    closing_date: "2026-04-01",
    closing_date_actual: "2026-04-03",
    notes: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-04-03T00:00:00Z",
    ...overrides,
  } as TransactionRow;
}

describe("applyOnCloseBackfill", () => {
  beforeEach(() => {
    updateMock.mockClear();
  });

  it("writes closing_date / price / address when active → closed", async () => {
    await applyOnCloseBackfill({ status: "active" }, baseRow());
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toEqual({
      closing_date: "2026-04-03", // prefers actual close date
      closing_price: 1_200_000,
      closing_address: "500 Sutter St",
    });
  });

  it("no-ops when the deal was already closed before the update", async () => {
    await applyOnCloseBackfill({ status: "closed" }, baseRow());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("no-ops when the update doesn't land on closed status", async () => {
    await applyOnCloseBackfill({ status: "active" }, baseRow({ status: "pending" }));
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("falls back to closing_date when closing_date_actual is null", async () => {
    await applyOnCloseBackfill(
      { status: "active" },
      baseRow({ closing_date_actual: null }),
    );
    expect(updateMock.mock.calls[0][0].closing_date).toBe("2026-04-01");
  });

  it("uses today when neither close date is set (still record the event)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await applyOnCloseBackfill(
      { status: "active" },
      baseRow({ closing_date_actual: null, closing_date: null }),
    );
    expect(updateMock.mock.calls[0][0].closing_date).toBe(today);
  });

  it("passes a null closing_price through when the deal never had one", async () => {
    await applyOnCloseBackfill(
      { status: "active" },
      baseRow({ purchase_price: null }),
    );
    expect(updateMock.mock.calls[0][0].closing_price).toBeNull();
  });

  it("no-ops when the transaction has no contact_id (bad data guard)", async () => {
    await applyOnCloseBackfill(
      { status: "active" },
      baseRow({ contact_id: "" }),
    );
    expect(updateMock).not.toHaveBeenCalled();
  });
});
