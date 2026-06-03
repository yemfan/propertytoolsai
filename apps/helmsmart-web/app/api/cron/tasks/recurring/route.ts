/**
 * GET /api/cron/tasks/recurring
 *
 * Spawns a fresh open task from each active recurring_tasks template whose
 * next_run_date <= today (due_date = next_run_date), then advances
 * next_run_date by its frequency. Runs daily via Vercel Cron.
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
      .from("recurring_tasks")
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
        const { error: insErr } = await supabase.from("tasks").insert({
          organization_id: rec.organization_id,
          client_id: rec.client_id ?? null,
          title: rec.title,
          notes: rec.notes ?? null,
          priority: rec.priority ?? "normal",
          due_date: rec.next_run_date,
          status: "open",
        });
        if (insErr) throw new Error(insErr.message);

        await supabase
          .from("recurring_tasks")
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
