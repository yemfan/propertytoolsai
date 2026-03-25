import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AffordabilityInput, AffordabilityResult } from "./types";

export async function persistAffordabilitySession(
  sessionId: string,
  input: Omit<AffordabilityInput, "sessionId">,
  result: AffordabilityResult
) {
  const { error } = await supabaseAdmin
    .from("affordability_sessions")
    .upsert(
      {
        session_id: sessionId,
        input_json: input,
        result_json: result,
        max_home_price: result.maxHomePrice,
        target_loan_amount: result.targetLoanAmount,
        monthly_budget: result.maxMonthlyHousingBudget,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

  if (error) throw error;
}

export async function getAffordabilitySession(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("affordability_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
