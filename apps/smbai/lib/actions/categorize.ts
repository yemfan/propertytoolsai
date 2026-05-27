"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type RawTxn = {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  personal_finance_category: string | null;
  category_legacy: string[] | null;
};

type CoaRow = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Categorization = {
  transaction_id: string;
  account_code: string;
  confidence: number;
  memo: string;
};

type ClaudeResult = {
  categorizations: Categorization[];
};

/**
 * Categorize a batch of uncategorized bank_transactions using Claude.
 *
 * Fetches uncategorized transactions for the org, passes them to Claude
 * alongside the chart of accounts, then writes back:
 *   - coa_account_id (matched by account code)
 *   - ai_category_confidence
 *   - ai_suggested_memo
 *
 * Safe to call multiple times — only processes transactions where
 * coa_account_id IS NULL.
 *
 * @param orgId   Organization UUID
 * @param limit   Max transactions to categorize per call (default 50)
 */
export async function categorizeTransactions(
  orgId: string,
  limit = 50
): Promise<{ categorized: number; error?: string }> {
  const service = createServiceClient();

  // 1. Fetch org metadata for context
  const { data: org } = await service
    .from("organizations")
    .select("name, entity_type")
    .eq("id", orgId)
    .single();

  if (!org) return { categorized: 0, error: "Organization not found." };

  // 2. Fetch chart of accounts (expense + revenue only — those are the targets)
  const { data: coa } = await service
    .from("chart_of_accounts")
    .select("id, code, name, type")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .in("type", ["expense", "revenue", "asset", "liability"])
    .order("code");

  if (!coa?.length) return { categorized: 0, error: "No chart of accounts found." };

  // 3. Fetch uncategorized transactions
  const { data: txns } = await service
    .from("bank_transactions")
    .select("id, name, merchant_name, amount, date, personal_finance_category, category_legacy")
    .eq("organization_id", orgId)
    .is("coa_account_id", null)
    .eq("pending", false)
    .order("date", { ascending: false })
    .limit(limit);

  if (!txns?.length) return { categorized: 0 };

  // 4. Build CoA reference string
  const coaText = (coa as CoaRow[])
    .map((a) => `${a.code} | ${a.name} | ${a.type}`)
    .join("\n");

  // 5. Build transaction list
  const txnText = (txns as RawTxn[])
    .map((t) => {
      const direction = t.amount > 0 ? "DEBIT (money out)" : "CREDIT (money in)";
      const merchant = t.merchant_name ?? t.name;
      const cat = t.personal_finance_category ?? t.category_legacy?.join(" > ") ?? "";
      return `ID:${t.id} | ${t.date} | ${direction} $${Math.abs(t.amount).toFixed(2)} | ${merchant} | ${cat}`;
    })
    .join("\n");

  // 6. Call Claude
  const systemPrompt = `You are an expert bookkeeper for a ${org.entity_type.replace("_", " ")} business called "${org.name}".
Your job is to categorize bank transactions into the correct account from the chart of accounts.

Rules:
- DEBIT transactions (money out, positive Plaid amount) → expense or liability accounts
- CREDIT transactions (money in, negative Plaid amount) → revenue or asset accounts
- Match as specifically as possible (e.g. "UBER" → Auto & Truck Expenses, not Other Expenses)
- For transfers between own accounts, use the most appropriate asset account
- confidence: 0.95+ very sure, 0.80-0.94 reasonably sure, 0.60-0.79 uncertain, below 0.60 = use Other
- memo: 3-8 word plain-English description of what the charge is for

Respond ONLY with valid JSON matching this schema exactly:
{
  "categorizations": [
    { "transaction_id": "uuid", "account_code": "code", "confidence": 0.0, "memo": "string" }
  ]
}`;

  const userPrompt = `Chart of accounts (code | name | type):
${coaText}

Transactions to categorize (ID | date | direction | amount | merchant | Plaid category):
${txnText}`;

  let result: ClaudeResult;
  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Strip markdown code fences if present
    const json = text.replace(/```(?:json)?\n?/g, "").trim();
    result = JSON.parse(json) as ClaudeResult;
  } catch (err) {
    console.error("[categorize] Claude call failed:", err);
    return { categorized: 0, error: "AI categorization failed." };
  }

  if (!result.categorizations?.length) return { categorized: 0 };

  // 7. Build a code → id map for fast lookup
  const codeToId = new Map((coa as CoaRow[]).map((a) => [a.code, a.id]));

  // 8. Write back to DB
  let categorized = 0;
  for (const cat of result.categorizations) {
    const accountId = codeToId.get(cat.account_code);
    if (!accountId) continue; // Claude hallucinated a code — skip

    const { error } = await service
      .from("bank_transactions")
      .update({
        coa_account_id: accountId,
        ai_category_confidence: Math.min(1, Math.max(0, cat.confidence)),
        ai_suggested_memo: cat.memo ?? null,
      })
      .eq("id", cat.transaction_id)
      .eq("organization_id", orgId); // extra safety: can't touch other orgs

    if (!error) categorized++;
  }

  return { categorized };
}
