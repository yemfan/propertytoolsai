import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";
import { computeTotals, formatDocNumber } from "./money";

type Db = SupabaseClient<Database>;

export interface EstimateLineInput {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order?: number;
}

export interface CreateEstimateInput {
  clientId: string | null;
  expiryDate: string;
  taxRate: number;
  notes: string;
  lines: EstimateLineInput[];
}

/** Next sequential estimate number for an org, e.g. "EST-0007". */
export async function nextEstimateNumber(db: Db, orgId: string): Promise<string> {
  const { count } = await db
    .from("estimates")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return formatDocNumber("EST", (count ?? 0) + 1);
}

/** Insert an estimate + its line items (pure persistence; caller revalidates). Returns the new id. */
export async function insertEstimateWithLines(
  db: Db,
  orgId: string,
  input: CreateEstimateInput
): Promise<string> {
  const { subtotal, taxAmount, total } = computeTotals(input.lines, input.taxRate);
  const estimateNumber = await nextEstimateNumber(db, orgId);

  const { data: est, error } = await db
    .from("estimates")
    .insert({
      organization_id: orgId,
      client_id: input.clientId || null,
      estimate_number: estimateNumber,
      status: "draft",
      issue_date: new Date().toISOString().slice(0, 10),
      expiry_date: input.expiryDate,
      subtotal,
      tax_rate: input.taxRate,
      tax_amount: taxAmount,
      total,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (error || !est) throw new Error(error?.message ?? "Failed to create estimate");

  if (input.lines.length > 0) {
    await db.from("estimate_lines").insert(
      input.lines.map((l, i) => ({
        estimate_id: est.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: l.amount,
        sort_order: i,
      }))
    );
  }

  return est.id;
}

/** Update an estimate's lifecycle status. Org-scoped. */
export async function setEstimateStatus(
  db: Db,
  orgId: string,
  estimateId: string,
  status: "accepted" | "declined" | "expired"
): Promise<void> {
  await db
    .from("estimates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", estimateId)
    .eq("organization_id", orgId);
}
