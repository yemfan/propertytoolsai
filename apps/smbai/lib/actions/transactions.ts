"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postTransaction } from "@/lib/actions/ledger";

export type ApproveState = { error?: string; success?: boolean } | null;

/**
 * Approve a transaction: mark it reviewed, optionally override the CoA account,
 * then post it to the double-entry journal.
 */
export async function approveTransaction(
  _: ApproveState,
  formData: FormData
): Promise<ApproveState> {
  const transactionId = formData.get("transaction_id") as string;
  const coaAccountId = formData.get("coa_account_id") as string | null;
  const memo = (formData.get("memo") as string)?.trim() || null;

  if (!transactionId) return { error: "Missing transaction ID." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  // Update the transaction
  const update: Record<string, unknown> = { reviewed: true, memo };
  if (coaAccountId) update.coa_account_id = coaAccountId;

  const { error: updateError } = await supabase
    .from("bank_transactions")
    .update(update)
    .eq("id", transactionId);

  if (updateError) return { error: "Failed to approve transaction." };

  // Post to journal (non-fatal if it fails — transaction is still marked reviewed)
  await postTransaction(transactionId).catch((e) =>
    console.warn("[approve] journal posting failed:", e)
  );

  revalidatePath("/books/transactions");
  return { success: true };
}

/**
 * Skip a transaction (mark reviewed without categorizing or posting to journal).
 * Useful for transfers, personal expenses, etc.
 */
export async function skipTransaction(transactionId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("bank_transactions")
    .update({ reviewed: true, memo: "[Skipped]" })
    .eq("id", transactionId);

  if (error) return { error: "Failed to skip transaction." };

  revalidatePath("/books/transactions");
  return {};
}
