"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Suggest the best-matching chart-of-accounts expense account for a free-text
 * description / vendor name, choosing from the org's ACTUAL accounts.
 *
 * Returns the chosen account id + a one-line reason, or null if nothing fits.
 */
export async function suggestExpenseAccount(
  text: string
): Promise<{ accountId: string; accountName: string; reason: string } | null> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return null;
  if (!text.trim()) return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("organization_id", orgId)
    .eq("type", "expense")
    .eq("is_active", true)
    .order("code");

  if (!accounts?.length) return null;

  const accountList = accounts.map((a) => `${a.code} — ${a.name} [id:${a.id}]`).join("\n");

  const prompt = `You are a bookkeeping assistant. Given an expense description or vendor name, pick the single best-matching expense account from the chart of accounts below.

Expense: "${text.trim()}"

Available expense accounts:
${accountList}

Respond with ONLY a JSON object (no markdown):
{"id":"<the chosen account id>","reason":"<3-8 word reason>"}

Rules:
- "id" MUST be one of the [id:...] values above, copied exactly.
- Pick the most specific reasonable match. If unsure, choose the closest general account.`;

  let raw = "";
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    raw = (resp.content[0] as { type: string; text: string }).text ?? "";
  } catch (e) {
    console.error("[expense-categorize] Claude error:", e);
    return null;
  }

  let parsed: { id: string; reason: string };
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m?.[0] ?? raw);
  } catch {
    return null;
  }

  const match = accounts.find((a) => a.id === parsed.id);
  if (!match) return null;

  return {
    accountId: match.id,
    accountName: match.name,
    reason: (parsed.reason ?? "").slice(0, 60),
  };
}
