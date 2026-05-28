"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkProjectBudgetAlert } from "./budget-alerts";

export interface ExpenseInput {
  date: string;              // YYYY-MM-DD
  amount: number;            // positive
  description: string;
  expenseAccountId: string;  // CoA account (type = expense)
  /** Bank account ID → CR that bank. Null → CR Accounts Payable */
  paymentSourceId: string | null;
  /** Optional project to attribute this expense to (for project P&L). */
  projectId?: string | null;
}

export async function createExpense(input: ExpenseInput) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();

  // Resolve credit account: bank CoA or Accounts Payable
  let creditAccountId: string;

  if (input.paymentSourceId) {
    // Use the bank account's mapped CoA account
    const { data: bank } = await supabase
      .from("bank_accounts")
      .select("coa_account_id")
      .eq("id", input.paymentSourceId)
      .eq("organization_id", orgId)
      .single();
    if (!bank?.coa_account_id) throw new Error("Bank account has no CoA mapping — set it in Settings first");
    creditAccountId = bank.coa_account_id;
  } else {
    // Accounts Payable (first liability account with "payable" in name, or just first liability)
    const { data: ap } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("type", "liability")
      .ilike("name", "%payable%")
      .order("code")
      .limit(1)
      .single();
    if (!ap) throw new Error("No Accounts Payable account found in Chart of Accounts");
    creditAccountId = ap.id;
  }

  // Verify expense account belongs to this org
  const { data: expAcct } = await supabase
    .from("chart_of_accounts")
    .select("id, name")
    .eq("id", input.expenseAccountId)
    .eq("organization_id", orgId)
    .single();
  if (!expAcct) throw new Error("Expense account not found");

  // Post journal entry: DR expense / CR bank (or payable)
  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: orgId,
      date: input.date,
      memo: input.description,
      source_type: "expense",
      project_id: input.projectId ?? null,
    })
    .select("id")
    .single();

  if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed to create journal entry");

  await supabase.from("journal_lines").insert([
    {
      journal_entry_id: je.id,
      account_id: input.expenseAccountId,
      debit: input.amount,
      credit: 0,
      description: input.description,
    },
    {
      journal_entry_id: je.id,
      account_id: creditAccountId,
      debit: 0,
      credit: input.amount,
      description: input.description,
    },
  ]);

  revalidatePath("/books");
  revalidatePath("/books/expenses");
  revalidatePath("/books/journal");
  revalidatePath("/books/reports");
  revalidatePath("/reports");
  if (input.projectId) {
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/projects");
    await checkProjectBudgetAlert(input.projectId);
  }
}

// ─── List expense journal entries ─────────────────────────────────────────────

export async function listExpenses(limit = 100) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return [];

  const supabase = await createClient();

  // Join journal_entries (source_type = expense) → journal_lines (debit side) → CoA name
  const { data } = await supabase
    .from("journal_entries")
    .select(`
      id,
      date,
      memo,
      created_at,
      journal_lines (
        debit,
        credit,
        account:account_id (
          id, name, type, code
        )
      )
    `)
    .eq("organization_id", orgId)
    .eq("source_type", "expense")
    .order("date", { ascending: false })
    .limit(limit);

  // Flatten: one row per expense entry, pulling the debit (expense) line for the amount
  type LineShape = {
    debit: number;
    credit: number;
    account: { id: string; name: string; type: string; code: string } | { id: string; name: string; type: string; code: string }[] | null;
  };
  return (data ?? []).map((je) => {
    const lines = (je.journal_lines ?? []) as unknown as LineShape[];
    const debitLine = lines.find((l) => {
      const acct = Array.isArray(l.account) ? l.account[0] : l.account;
      return Number(l.debit) > 0 && acct?.type === "expense";
    });
    const acct = debitLine
      ? (Array.isArray(debitLine.account) ? debitLine.account[0] : debitLine.account)
      : null;
    return {
      id: je.id,
      date: je.date as string,
      memo: je.memo as string | null,
      amount: debitLine ? Number(debitLine.debit) : 0,
      accountName: acct?.name ?? "—",
      accountCode: acct?.code ?? "",
    };
  });
}

// ─── Project expenses (for project P&L) ───────────────────────────────────────

export type ProjectExpense = {
  id: string;
  date: string;
  memo: string | null;
  amount: number;
  accountName: string;
};

/** Expense journal entries attributed to a given project. */
export async function listProjectExpenses(projectId: string): Promise<ProjectExpense[]> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select(`
      id,
      date,
      memo,
      journal_lines (
        debit,
        account:account_id ( name, type )
      )
    `)
    .eq("organization_id", orgId)
    .eq("project_id", projectId)
    .eq("source_type", "expense")
    .order("date", { ascending: false });

  type LineShape = {
    debit: number;
    account: { name: string; type: string } | { name: string; type: string }[] | null;
  };
  return (data ?? []).map((je) => {
    const lines = (je.journal_lines ?? []) as unknown as LineShape[];
    const debitLine = lines.find((l) => {
      const acct = Array.isArray(l.account) ? l.account[0] : l.account;
      return Number(l.debit) > 0 && acct?.type === "expense";
    });
    const acct = debitLine
      ? (Array.isArray(debitLine.account) ? debitLine.account[0] : debitLine.account)
      : null;
    return {
      id: je.id as string,
      date: je.date as string,
      memo: je.memo as string | null,
      amount: debitLine ? Number(debitLine.debit) : 0,
      accountName: acct?.name ?? "—",
    };
  });
}

/** Total expense amount attributed to a project. */
export async function getProjectExpenseTotal(projectId: string): Promise<number> {
  const rows = await listProjectExpenses(projectId);
  return rows.reduce((sum, r) => sum + r.amount, 0);
}
