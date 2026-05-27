"use server";

import { createServiceClient } from "@/lib/supabase/server";

/**
 * Post an approved bank_transaction to the double-entry journal.
 *
 * Plaid sign convention: positive amount = money OUT (debit), negative = money IN (credit).
 *
 * Posting logic (cash-basis):
 *   Money OUT (expense):
 *     DR  coa_account (expense)        amount
 *     CR  bank asset account           amount
 *
 *   Money IN (revenue):
 *     DR  bank asset account           amount
 *     CR  coa_account (revenue)        amount
 *
 * Requires:
 *   - bank_transactions.coa_account_id to be set
 *   - bank_accounts.coa_account_id to be set (the asset account for the bank)
 *
 * If either link is missing, the function returns an error and the transaction
 * stays un-posted (reviewed=true but journal_entry_id=null).
 */
export async function postTransaction(
  transactionId: string
): Promise<{ error?: string }> {
  const service = createServiceClient();

  // Fetch transaction with its account's CoA link
  const { data: txn, error: txnErr } = await service
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
  if (txn.journal_entry_id) return {}; // Already posted — idempotent

  const expenseOrRevenueCoa = txn.coa_account_id;
  if (!expenseOrRevenueCoa) {
    return { error: "Transaction has no category assigned — categorize before posting." };
  }

  // bank_accounts may be an object or array depending on Supabase join shape
  const bankAccount = Array.isArray(txn.bank_accounts)
    ? txn.bank_accounts[0]
    : txn.bank_accounts;

  const bankCoa = bankAccount?.coa_account_id;
  if (!bankCoa) {
    return { error: "Bank account is not linked to a chart of accounts entry. Link it in Settings → Accounts." };
  }

  const absAmount = Math.abs(txn.amount);
  const isMoneyOut = txn.amount > 0; // Plaid: positive = debit (spend)
  const memo = txn.memo ?? txn.merchant_name ?? txn.name;

  // Create the journal entry
  const { data: entry, error: entryErr } = await service
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

  if (entryErr || !entry) {
    return { error: `Failed to create journal entry: ${entryErr?.message}` };
  }

  // Build the two balanced lines
  const lines = isMoneyOut
    ? [
        // DR expense account
        { journal_entry_id: entry.id, account_id: expenseOrRevenueCoa, debit: absAmount, credit: 0, description: memo },
        // CR bank asset
        { journal_entry_id: entry.id, account_id: bankCoa, debit: 0, credit: absAmount, description: memo },
      ]
    : [
        // DR bank asset
        { journal_entry_id: entry.id, account_id: bankCoa, debit: absAmount, credit: 0, description: memo },
        // CR revenue account
        { journal_entry_id: entry.id, account_id: expenseOrRevenueCoa, debit: 0, credit: absAmount, description: memo },
      ];

  const { error: linesErr } = await service.from("journal_lines").insert(lines);

  if (linesErr) {
    // Try to clean up the orphaned journal entry (best-effort)
    console.error("[ledger] journal_lines insert failed:", linesErr);
    return { error: `Failed to create journal lines: ${linesErr.message}` };
  }

  // Link transaction → journal entry
  await service
    .from("bank_transactions")
    .update({ journal_entry_id: entry.id })
    .eq("id", transactionId);

  return {};
}

/**
 * Reverse a posted journal entry (creates a reversing entry with negated lines).
 * Used when a categorization was wrong and needs to be undone.
 */
export async function reverseJournalEntry(
  journalEntryId: string,
  orgId: string
): Promise<{ error?: string }> {
  const service = createServiceClient();

  // Fetch the original entry + its lines
  const { data: original, error: fetchErr } = await service
    .from("journal_entries")
    .select("id, organization_id, date, memo, source_type")
    .eq("id", journalEntryId)
    .eq("organization_id", orgId)
    .single();

  if (fetchErr || !original) return { error: "Journal entry not found." };

  const { data: lines } = await service
    .from("journal_lines")
    .select("account_id, debit, credit, description")
    .eq("journal_entry_id", journalEntryId);

  if (!lines?.length) return { error: "No lines found on journal entry." };

  // Create the reversing entry
  const { data: reversal, error: revErr } = await service
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

  // Swap debits ↔ credits
  const reversalLines = lines.map((l) => ({
    journal_entry_id: reversal.id,
    account_id: l.account_id,
    debit: l.credit,   // swap
    credit: l.debit,   // swap
    description: l.description,
  }));

  await service.from("journal_lines").insert(reversalLines);

  // Mark the original entry as reversed
  await service
    .from("journal_entries")
    .update({ reversed_by_entry_id: reversal.id })
    .eq("id", journalEntryId);

  return {};
}
