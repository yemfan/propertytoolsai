"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { postBankTransaction, reverseJournalEntry as reverseEntry } from "@helm/dna-finance";

// Double-entry posting/reversal logic lives in @helm/dna-finance (Finance DNA).
// These server actions own the service-role client + the "use server" boundary.

/** Post an approved bank_transaction to the double-entry journal (cash-basis). */
export async function postTransaction(transactionId: string): Promise<{ error?: string }> {
  return postBankTransaction(createServiceClient(), transactionId);
}

/** Reverse a posted journal entry (creates a reversing entry with debits/credits swapped). */
export async function reverseJournalEntry(
  journalEntryId: string,
  orgId: string
): Promise<{ error?: string }> {
  return reverseEntry(createServiceClient(), journalEntryId, orgId);
}
