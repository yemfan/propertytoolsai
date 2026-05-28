/**
 * GET /api/cron/invoices/reminders
 *
 * Dunning: emails a payment reminder for each overdue, unpaid invoice that
 * hasn't been reminded in the last 3 days. Tone escalates with how overdue the
 * invoice is (see lib/invoice-reminders). Fires an owner notification per send.
 * Called daily by Vercel Cron.
 *
 * Auth: Bearer token via CRON_SECRET (Vercel sets this when crons are
 * configured in vercel.json).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import {
  sendReminderForInvoice,
  daysOverdue,
  type ReminderInvoice,
} from "@/lib/invoice-reminders";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

  // Overdue, unpaid invoices not reminded in the last 3 days.
  const { data: invoices, error } = await db
    .from("invoices")
    .select(
      "id, invoice_number, total, due_date, client_id, reminder_count, last_reminder_sent_at, organization_id, clients(first_name, last_name, email)"
    )
    .in("status", ["sent", "overdue"])
    .lt("due_date", today)
    .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysAgo}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invoices?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  let skipped = 0;
  for (const inv of invoices) {
    const res = await sendReminderForInvoice(db, inv as ReminderInvoice);
    if (!res.sent) {
      skipped++;
      continue;
    }
    sent++;
    await createNotificationService(inv.organization_id, {
      type: "invoice_overdue",
      title: `Reminder sent: Invoice ${inv.invoice_number}`,
      body: `Payment reminder emailed — ${daysOverdue(inv.due_date)} days overdue, $${Number(inv.total).toFixed(2)}`,
      link: `/books/invoices/${inv.id}`,
    });
  }

  return NextResponse.json({ sent, skipped });
}
