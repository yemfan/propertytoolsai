import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";

type Db = SupabaseClient<Database>;

export interface ExpenseInput {
  date: string; // YYYY-MM-DD
  amount: number; // positive
  description: string;
  expenseAccountId: string; // CoA account (type = expense)
  /** Bank account id → CR that bank. Null → CR Accounts Payable. */
  paymentSourceId: string | null;
  /** Optional project to attribute this expense to (project P&L). */
  projectId?: string | null;
}

/**
 * Record an expense as a balanced double-entry journal:
 *   DR <expense account>  /  CR <bank account | Accounts Payable>.
 * Org-scoped, RLS-enforced. Pure persistence — the caller owns revalidation,
 * project budget alerts, and any notifications.
 */
export async function recordExpense(db: Db, orgId: string, input: ExpenseInput): Promise<void> {
  // Resolve the credit account: the bank's mapped CoA account, or Accounts Payable.
  let creditAccountId: string;

  if (input.paymentSourceId) {
    const { data: bank } = await db
      .from("bank_accounts")
      .select("coa_account_id")
      .eq("id", input.paymentSourceId)
      .eq("organization_id", orgId)
      .single();
    if (!bank?.coa_account_id) {
      throw new Error("Bank account has no CoA mapping — set it in Settings first");
    }
    creditAccountId = bank.coa_account_id;
  } else {
    const { data: ap } = await db
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

  // Verify the expense account belongs to this org.
  const { data: expAcct } = await db
    .from("chart_of_accounts")
    .select("id, name")
    .eq("id", input.expenseAccountId)
    .eq("organization_id", orgId)
    .single();
  if (!expAcct) throw new Error("Expense account not found");

  // Post the journal entry header.
  const { data: je, error: jeErr } = await db
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

  // Balanced lines: DR expense, CR bank|payable.
  await db.from("journal_lines").insert([
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
}
