/**
 * GET /api/cron/bills/recurring
 *
 * Spawns a fresh open bill from each active recurring_bills template whose
 * next_run_date <= today (issue_date = next_run_date, due_date = issue +
 * due_days), then advances next_run_date by its frequency. Runs daily via
 * Vercel Cron. Cash-basis: the bill is just an obligation — the expense posts
 * to the ledger when it's marked paid in /books/bills.
 *
 * Auth: Bearer token via CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClientFor, packServiceConns } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;
  let generated = 0;
  const errors: string[] = [];

  // Process every vertical's orgs — Core plus the medical project (if configured).
  for (const conn of packServiceConns()) {
    const supabase = createServiceClientFor(conn);

    const { data: due, error } = await supabase
      .from("recurring_bills")
      .select("*")
      .eq("status", "active")
      .lte("next_run_date", today);

    if (error) {
      errors.push(error.message);
      continue;
    }
    processed += (due ?? []).length;

    for (const rec of due ?? []) {
      try {
        const issueDate = rec.next_run_date as string;
        const dueDate = addDays(issueDate, rec.due_days ?? 30);

        const { error: insErr } = await supabase.from("bills").insert({
          organization_id: rec.organization_id,
          vendor: rec.vendor,
          description: rec.description ?? null,
          expense_account_id: rec.expense_account_id ?? null,
          amount: rec.amount,
          issue_date: issueDate,
          due_date: dueDate,
          status: "open",
        });
        if (insErr) throw new Error(insErr.message);

        await supabase
          .from("recurring_bills")
          .update({
            next_run_date: advanceDate(rec.next_run_date, rec.frequency),
            last_generated_at: new Date().toISOString(),
          })
          .eq("id", rec.id);

        generated++;
      } catch (err) {
        errors.push(`${rec.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, processed, generated, errors });
}
