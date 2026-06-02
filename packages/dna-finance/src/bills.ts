import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";

type Db = SupabaseClient<Database>;

export type BillStatus = "open" | "paid";

export interface CreateBillInput {
  vendor: string;
  description: string | null;
  billNumber: string | null;
  expenseAccountId: string | null;
  issueDate: string;
  dueDate: string;
  amount: number;
}

export interface PayBillInput {
  billId: string;
  bankAccountId: string;
  paymentDate: string;
}

/** Insert an open vendor bill (accounts payable). Pure persistence — caller revalidates. */
export async function insertBill(db: Db, orgId: string, input: CreateBillInput): Promise<void> {
  if (!input.vendor.trim()) throw new Error("Vendor is required");
  if (!input.dueDate) throw new Error("Due date is required");
  if (!input.amount || input.amount <= 0) throw new Error("Enter a valid amount");

  const { error } = await db.from("bills").insert({
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
}

/**
 * Pay a bill: recognize the expense on a cash basis by posting a balanced journal
 * (DR expense / CR bank) and mark the bill paid. Pure persistence — caller revalidates.
 */
export async function recordBillPayment(db: Db, orgId: string, input: PayBillInput): Promise<void> {
  const { data: bill, error: billErr } = await db
    .from("bills")
    .select("id, vendor, description, amount, expense_account_id, status")
    .eq("id", input.billId)
    .eq("organization_id", orgId)
    .single();
  if (billErr || !bill) throw new Error("Bill not found");
  if (bill.status === "paid") throw new Error("Bill is already paid");
  if (!bill.expense_account_id) {
    throw new Error("Bill has no expense category — edit it before paying");
  }

  // CR side: the bank account's mapped CoA account.
  const { data: bank } = await db
    .from("bank_accounts")
    .select("coa_account_id")
    .eq("id", input.bankAccountId)
    .eq("organization_id", orgId)
    .single();
  if (!bank?.coa_account_id) {
    throw new Error("Bank account has no Chart-of-Accounts mapping — set it in Settings first");
  }

  // DR side: verify the expense account belongs to this org.
  const { data: expAcct } = await db
    .from("chart_of_accounts")
    .select("id")
    .eq("id", bill.expense_account_id)
    .eq("organization_id", orgId)
    .single();
  if (!expAcct) throw new Error("Expense account not found");

  const amount = Number(bill.amount);
  const memo = `Bill payment — ${bill.vendor}${bill.description ? `: ${bill.description}` : ""}`;

  const { data: je, error: jeErr } = await db
    .from("journal_entries")
    .insert({ organization_id: orgId, date: input.paymentDate, memo, source_type: "expense" })
    .select("id")
    .single();
  if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed to post journal entry");

  const { error: linesErr } = await db.from("journal_lines").insert([
    { journal_entry_id: je.id, account_id: bill.expense_account_id, debit: amount, credit: 0, description: memo },
    { journal_entry_id: je.id, account_id: bank.coa_account_id, debit: 0, credit: amount, description: memo },
  ]);
  if (linesErr) throw new Error(linesErr.message);

  const { error: updErr } = await db
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
}
