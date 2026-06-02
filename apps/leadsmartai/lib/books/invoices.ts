import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { computeTotals, lineAmount } from "./money";

/**
 * Invoice service for the LeadSmart "Books" feature. Agent-scoped via
 * getCurrentAgentContext(); all access goes through supabaseAdmin (the new
 * invoices / invoice_lines tables carry no RLS policies) filtered by agent_id.
 */

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export type InvoiceRow = {
  id: string;
  agent_id: number | string;
  contact_id: string | null;
  client_name: string | null;
  client_email: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
};

export type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
};

export type InvoiceLineInput = { description: string; quantity: number; unitPrice: number };

/** Next per-agent invoice number, e.g. INV-0001. Count-based — fine for a single
 *  realtor; a same-number race is caught by the unique (agent_id, number) index. */
async function nextInvoiceNumber(agentId: string): Promise<string> {
  const { count } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId as never);
  return `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function listInvoices(limit = 100): Promise<InvoiceRow[]> {
  const { agentId } = await getCurrentAgentContext();
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("agent_id", agentId as never)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[books] listInvoices:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InvoiceRow[];
}

export async function getInvoice(
  id: string,
): Promise<{ invoice: InvoiceRow; lines: InvoiceLineRow[] } | null> {
  const { agentId } = await getCurrentAgentContext();
  const { data: inv } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!inv) return null;
  const { data: lines } = await supabaseAdmin
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });
  return {
    invoice: inv as unknown as InvoiceRow,
    lines: (lines ?? []) as unknown as InvoiceLineRow[],
  };
}

export type CreateInvoiceInput = {
  contactId?: string | null;
  clientName?: string;
  clientEmail?: string;
  dueDate?: string | null;
  taxRate?: number;
  notes?: string;
  lines: InvoiceLineInput[];
};

export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<{ ok: true; id: string; invoiceNumber: string } | { ok: false; error: string }> {
  const { agentId } = await getCurrentAgentContext();

  const cleanLines = (input.lines || [])
    .map((l) => ({
      description: String(l.description ?? "").trim(),
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
    }))
    .filter((l) => l.description.length > 0);
  if (cleanLines.length === 0) return { ok: false, error: "Add at least one line item." };

  const taxRate = Math.max(0, Number(input.taxRate) || 0);
  const { subtotal, taxAmount, total } = computeTotals(cleanLines, taxRate);
  const invoiceNumber = await nextInvoiceNumber(agentId);

  const { data: inv, error } = await supabaseAdmin
    .from("invoices")
    .insert({
      agent_id: agentId,
      contact_id: input.contactId ?? null,
      client_name: input.clientName?.trim() || null,
      client_email: input.clientEmail?.trim() || null,
      invoice_number: invoiceNumber,
      status: "draft",
      due_date: input.dueDate || null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: input.notes?.trim() || null,
    } as never)
    .select("id")
    .single();

  if (error || !inv) {
    console.error("[books] createInvoice:", error?.message);
    return { ok: false, error: error?.message || "Could not create the invoice." };
  }
  const invoiceId = String((inv as { id: unknown }).id);

  const lineRows = cleanLines.map((l, i) => ({
    invoice_id: invoiceId,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    amount: lineAmount(l.quantity, l.unitPrice),
    sort_order: i,
  }));
  const { error: lerr } = await supabaseAdmin.from("invoice_lines").insert(lineRows as never);
  if (lerr) console.error("[books] invoice_lines insert:", lerr.message);

  return { ok: true, id: invoiceId, invoiceNumber };
}

const VALID_STATUS: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

/** Update an invoice's status (sets paid_at when moving to paid). Agent-scoped. */
export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_STATUS.includes(status)) return { ok: false, error: "Invalid status." };
  const { agentId } = await getCurrentAgentContext();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  patch.paid_at = status === "paid" ? new Date().toISOString() : null;
  const { error } = await supabaseAdmin
    .from("invoices")
    .update(patch as never)
    .eq("id", id)
    .eq("agent_id", agentId as never);
  if (error) {
    console.error("[books] setInvoiceStatus:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
