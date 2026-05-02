import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  buildCoordinatorBoard,
  type CoordinatorBoard,
  type CoordinatorTaskInput,
  type CoordinatorTransactionInput,
} from "./grouping";

/**
 * Server orchestrator for the transaction-coordinator kanban.
 *
 * Pulls in-flight transactions (`status='active' | 'pending'`) plus
 * ALL their tasks in two batched queries, projects them onto the slim
 * input shapes the pure builder needs, and returns the assembled board.
 *
 * Does NOT include closed/terminated transactions — the coordinator
 * surface is "what needs my attention right now," and closed deals are
 * a separate analytics view (covered by /dashboard/performance).
 */

const ACTIVE_STATUSES = ["active", "pending"] as const;

export async function getCoordinatorBoardForAgent(
  agentId: string,
): Promise<CoordinatorBoard> {
  const todayIso = new Date().toISOString().slice(0, 10);

  // We do contact lookup as a separate batched query (not a PostgREST
  // foreign-table embed) so the page doesn't go down whenever
  // PostgREST's schema cache misses the transactions→contacts FK. The
  // embed used to fail on production with "Could not find a relationship
  // between 'transactions' and 'contacts' in the schema cache".
  const { data: txnRows, error: txnErr } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, agent_id, transaction_type, property_address, city, state, purchase_price, status, mutual_acceptance_date, closing_date, closing_date_actual, contact_id",
    )
    .eq("agent_id", agentId)
    .in("status", ACTIVE_STATUSES as unknown as never[])
    .order("closing_date", { ascending: true, nullsFirst: false });

  if (txnErr) throw new Error(txnErr.message);

  type RawTxn = {
    id: string;
    agent_id: string | number;
    transaction_type: CoordinatorTransactionInput["transaction_type"];
    property_address: string;
    city: string | null;
    state: string | null;
    purchase_price: number | null;
    status: CoordinatorTransactionInput["status"];
    mutual_acceptance_date: string | null;
    closing_date: string | null;
    closing_date_actual: string | null;
    contact_id: string | null;
  };

  const rawTxns = (txnRows ?? []) as RawTxn[];

  if (rawTxns.length === 0) {
    return buildCoordinatorBoard([], [], todayIso);
  }

  // Batch-fetch the contacts referenced by these transactions. One
  // round-trip, indexed by id (FK), so the cost is negligible even at
  // 100+ active deals.
  const contactIds = Array.from(
    new Set(rawTxns.map((r) => r.contact_id).filter((v): v is string => Boolean(v))),
  );
  const contactNameById = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contactRows, error: contactsErr } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, name")
      .in("id", contactIds);
    if (contactsErr) throw new Error(contactsErr.message);
    for (const c of (contactRows ?? []) as RawContact[]) {
      const display = pickContactName(c);
      if (display) contactNameById.set(c.id, display);
    }
  }

  const transactions: CoordinatorTransactionInput[] = rawTxns.map((r) => ({
    id: r.id,
    agent_id: String(r.agent_id),
    transaction_type: r.transaction_type,
    property_address: r.property_address,
    city: r.city,
    state: r.state,
    purchase_price: r.purchase_price,
    status: r.status,
    mutual_acceptance_date: r.mutual_acceptance_date,
    closing_date: r.closing_date,
    closing_date_actual: r.closing_date_actual,
    contact_name: r.contact_id ? contactNameById.get(r.contact_id) ?? null : null,
  }));

  const txnIds = transactions.map((t) => t.id);
  const { data: taskRows, error: taskErr } = await supabaseAdmin
    .from("transaction_tasks")
    .select("id, transaction_id, stage, title, due_date, completed_at")
    .in("transaction_id", txnIds);

  if (taskErr) throw new Error(taskErr.message);

  const tasks = (taskRows ?? []) as CoordinatorTaskInput[];

  return buildCoordinatorBoard(transactions, tasks, todayIso);
}

function pickContactName(c: RawContact | null): string | null {
  if (!c) return null;
  if (c.first_name || c.last_name) {
    return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || null;
  }
  return c.name ?? null;
}

type RawContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
};
