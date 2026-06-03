/**
 * GET /api/cron/daily
 *
 * Single daily dispatcher: runs every scheduled job in sequence from one cron
 * invocation, so we stay within Vercel Hobby's 2-cron limit. Auth is checked
 * once here; the dispatcher forwards this request (with its Authorization
 * header) to each job handler, whose own CRON_SECRET check then passes.
 * Each job is isolated in try/catch so one failure doesn't block the rest.
 *
 * The individual job routes remain callable directly (e.g. for manual runs).
 *
 * Auth: Bearer token via CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as invoicesOverdue } from "../invoices/overdue/route";
import { GET as invoicesRecurring } from "../invoices/recurring/route";
import { GET as invoicesReminders } from "../invoices/reminders/route";
import { GET as projectsRecurring } from "../projects/recurring/route";
import { GET as billsRecurring } from "../bills/recurring/route";
import { GET as tasksRecurring } from "../tasks/recurring/route";
import { GET as weeklyDigest } from "../digest/weekly/route";

export const dynamic = "force-dynamic";
// Allow more time — six jobs run sequentially in one invocation.
export const maxDuration = 300;

const JOBS: { name: string; run: (req: NextRequest) => Promise<Response> }[] = [
  { name: "invoices/overdue",   run: invoicesOverdue },
  { name: "invoices/recurring", run: invoicesRecurring },
  { name: "invoices/reminders", run: invoicesReminders },
  { name: "projects/recurring", run: projectsRecurring },
  { name: "bills/recurring",    run: billsRecurring },
  { name: "tasks/recurring",    run: tasksRecurring },
  { name: "digest/weekly",      run: weeklyDigest },
];

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results: Record<string, unknown> = {};
  for (const job of JOBS) {
    try {
      const res = await job.run(request);
      results[job.name] = await res.json().catch(() => ({ status: res.status }));
    } catch (err) {
      results[job.name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, ran: JOBS.length, results });
}
