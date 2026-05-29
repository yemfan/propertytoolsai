"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type BillStatus = "open" | "paid";

export interface Bill {
  id: string;
  vendor: string;
  description: string | null;
  bill_number: string | null;
  expense_account_id: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  status: BillStatus;
  paid_at: string | null;
  paid_bank_account_id: string | null;
  journal_entry_id: string | null;
  created_at: string;
  expense_account?: { name: string; code: string } | null;
}

async function getOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("helmsmart-org-id")?.value ?? null;
}

export async function listBills(): Promise<Bill[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("bills")
    .select(
      "id, vendor, description, bill_number, expense_account_id, issue_date, due_date, amount, status, paid_at, paid_bank_account_id, journal_entry_id, created_at, expense_account:expense_account_id(name, code)"
    )
    .eq("organization_id", orgId)
    .order("status", { ascending: true }) // 'open' sorts before 'paid'
    .order("due_date", { ascending: true });

  return (data ?? []).map((b) => ({
    ...b,
    amount: Number(b.amount),
    expense_account:
      (Array.isArray(b.expense_account) ? b.expense_account[0] : b.expense_account) ?? null,
  })) as Bill[];
}

export async function createBill(input: {
  vendor: string;
  description: string | null;
  billNumber: string | null;
  expenseAccountId: string | null;
  issueDate: string;
  dueDate: string;
  amount: number;
}): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  if (!input.vendor.trim()) throw new Error("Vendor is required");
  if (!input.dueDate) throw new Error("Due date is required");
  if (!input.amount || input.amount <= 0) throw new Error("Enter a valid amount");

  const supabase = await createClient();
  const { error } = await supabase.from("bills").insert({
    organization_id: orgId,
    vendor: input.vendor.trim(),
    description: input.description,
    bill_number: input.billNumber,
    expense_account_id: input.expenseAccountId,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    amount: input.amount,
    status: "open",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/books/bills");
}

/**
 * Pay a bill: post the expense journal entry (DR expense / CR bank) — this is
 * where the expense is recognized on a cash basis — and mark the bill paid.
 */
export async function payBill(input: {
  billId: string;
  bankAccountId: string;
  paymentDate: string;
}): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();

  const { data: bill, error: billErr } = await supabase
    .from("bills")
    .select("id, vendor, description, amount, expense_account_id, status")
    .eq("id", input.billId)
    .eq("organization_id", orgId)
    .single();
  if (billErr || !bill) throw new Error("Bill not found");
  if (bill.status === "paid") throw new Error("Bill is already paid");
  if (!bill.expense_account_id) throw new Error("Bill has no expense category — edit it before paying");

  // CR side: the bank account's mapped Chart-of-Accounts account
  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("coa_account_id")
    .eq("id", input.bankAccountId)
    .eq("organization_id", orgId)
    .single();
  if (!bank?.coa_account_id)
    throw new Error("Bank account has no Chart-of-Accounts mapping — set it in Settings first");

  // DR side: verify the expense account belongs to this org
  const { data: expAcct } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("id", bill.expense_account_id)
    .eq("organization_id", orgId)
    .single();
  if (!expAcct) throw new Error("Expense account not found");

  const amount = Number(bill.amount);
  const memo = `Bill payment — ${bill.vendor}${bill.description ? `: ${bill.description}` : ""}`;

  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: orgId,
      date: input.paymentDate,
      memo,
      source_type: "expense",
    })
    .select("id")
    .single();
  if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed to post journal entry");

  const { error: linesErr } = await supabase.from("journal_lines").insert([
    { journal_entry_id: je.id, account_id: bill.expense_account_id, debit: amount, credit: 0, description: memo },
    { journal_entry_id: je.id, account_id: bank.coa_account_id, debit: 0, credit: amount, description: memo },
  ]);
  if (linesErr) throw new Error(linesErr.message);

  const { error: updErr } = await supabase
    .from("bills")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_bank_account_id: input.bankAccountId,
      journal_entry_id: je.id,
    })
    .eq("id", bill.id)
    .eq("organization_id", orgId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/books/bills");
  revalidatePath("/books/expenses");
  revalidatePath("/books/journal");
  revalidatePath("/books/reports");
  revalidatePath("/books");
  revalidatePath("/reports");
}

export async function deleteBill(id: string): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  const supabase = await createClient();

  // Paid bills have a posted journal entry — don't allow silent deletion.
  const { data: bill } = await supabase
    .from("bills")
    .select("status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();
  if (!bill) throw new Error("Bill not found");
  if (bill.status === "paid") throw new Error("Can't delete a paid bill — it has a posted journal entry");

  await supabase.from("bills").delete().eq("id", id).eq("organization_id", orgId);
  revalidatePath("/books/bills");
}
