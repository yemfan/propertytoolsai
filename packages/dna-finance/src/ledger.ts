import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";

type Db = SupabaseClient<Database>;

/**
 * Post an approved bank_transaction to the double-entry journal (cash-basis).
 * Plaid sign convention: positive amount = money OUT (debit), negative = money IN (credit).
 *   Money OUT: DR coa(expense) / CR bank-asset.   Money IN: DR bank-asset / CR coa(revenue).
 * Idempotent (no-op if already linked to a journal entry). Trusted server op — pass a
 * service-role client. Pure persistence: the app owns revalidation.
 */
export async function postBankTransaction(
  db: Db,
  transactionId: string
): Promise<{ error?: string }> {
  const { data: txn, error: txnErr } = await db
    .from("bank_transactions")
    .select(`
      id, organization_id, amount, date, name, merchant_name, memo,
      coa_account_id,
      journal_entry_id,
      bank_accounts!inner (
        id,
        coa_account_id
      )
    `)
    .eq("id", transactionId)
    .single();

  if (txnErr || !txn) return { error: "Transaction not found." };
  if (txn.journal_entry_id) return {}; // already posted — idempotent

  const expenseOrRevenueCoa = txn.coa_account_id;
  if (!expenseOrRevenueCoa) {
    return { error: "Transaction has no category assigned — categorize before posting." };
  }

  // The join may surface as an object or a single-element array depending on shape.
  const bankAccount = Array.isArray(txn.bank_accounts) ? txn.bank_accounts[0] : txn.bank_accounts;
  const bankCoa = bankAccount?.coa_account_id;
  if (!bankCoa) {
    return { error: "Bank account is not linked to a chart of accounts entry. Link it in Settings → Accounts." };
  }

  const absAmount = Math.abs(txn.amount);
  const isMoneyOut = txn.amount > 0;
  const memo = txn.memo ?? txn.merchant_name ?? txn.name;

  const { data: entry, error: entryErr } = await db
    .from("journal_entries")
    .insert({
      organization_id: txn.organization_id,
      date: txn.date,
      memo,
      source_type: "bank_import",
      source_id: txn.id,
      is_reversal: false,
    })
    .select("id")
    .single();

  if (entryErr || !entry) return { error: `Failed to create journal entry: ${entryErr?.message}` };

  const lines = isMoneyOut
    ? [
        { journal_entry_id: entry.id, account_id: expenseOrRevenueCoa, debit: absAmount, credit: 0, description: memo },
        { journal_entry_id: entry.id, account_id: bankCoa, debit: 0, credit: absAmount, description: memo },
      ]
    : [
        { journal_entry_id: entry.id, account_id: bankCoa, debit: absAmount, credit: 0, description: memo },
        { journal_entry_id: entry.id, account_id: expenseOrRevenueCoa, debit: 0, credit: absAmount, description: memo },
      ];

  const { error: linesErr } = await db.from("journal_lines").insert(lines);
  if (linesErr) {
    console.error("[dna-finance/ledger] journal_lines insert failed:", linesErr);
    return { error: `Failed to create journal lines: ${linesErr.message}` };
  }

  await db.from("bank_transactions").update({ journal_entry_id: entry.id }).eq("id", transactionId);
  return {};
}

/**
 * Reverse a posted journal entry by creating a reversing entry with debits/credits swapped,
 * and marking the original reversed. Org-scoped. Pure persistence.
 */
export async function reverseJournalEntry(
  db: Db,
  journalEntryId: string,
  orgId: string
): Promise<{ error?: string }> {
  const { data: original, error: fetchErr } = await db
    .from("journal_entries")
    .select("id, organization_id, date, memo, source_type")
    .eq("id", journalEntryId)
    .eq("organization_id", orgId)
    .single();
  if (fetchErr || !original) return { error: "Journal entry not found." };

  const { data: lines } = await db
    .from("journal_lines")
    .select("account_id, debit, credit, description")
    .eq("journal_entry_id", journalEntryId);
  if (!lines?.length) return { error: "No lines found on journal entry." };

  const { data: reversal, error: revErr } = await db
    .from("journal_entries")
    .insert({
      organization_id: orgId,
      date: new Date().toISOString().slice(0, 10),
      memo: `Reversal of: ${original.memo ?? ""}`.trim(),
      source_type: "reversal",
      is_reversal: true,
      reversed_entry_id: journalEntryId,
    })
    .select("id")
    .single();
  if (revErr || !reversal) return { error: "Failed to create reversal entry." };

  const reversalLines = lines.map((l) => ({
    journal_entry_id: reversal.id,
    account_id: l.account_id,
    debit: l.credit, // swap
    credit: l.debit, // swap
    description: l.description,
  }));
  await db.from("journal_lines").insert(reversalLines);

  await db
    .from("journal_entries")
    .update({ reversed_by_entry_id: reversal.id })
    .eq("id", journalEntryId);
  return {};
}
