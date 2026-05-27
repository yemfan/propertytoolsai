/**
 * POST /api/cron/invoices/overdue
 *
 * Marks sent invoices whose due_date has passed as "overdue" and fires
 * invoice_overdue notifications. Called daily by Vercel Cron.
 *
 * Auth: Bearer token via CRON_SECRET env var (Vercel sets this automatically
 * when crons are configured in vercel.json).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret (or CRON_SECRET env)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Find all sent invoices past their due date
  const { data: overdueInvoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, organization_id, clients(first_name, last_name, company)")
    .eq("status", "sent")
    .lt("due_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!overdueInvoices?.length) {
    return NextResponse.json({ processed: 0 });
  }

  // Mark all as overdue in one update per org
  const ids = overdueInvoices.map((i) => i.id);
  await supabase
    .from("invoices")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .in("id", ids);

  // Fire one notification per invoice
  for (const inv of overdueInvoices) {
    const clientRaw = inv.clients;
    const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as {
      first_name: string | null; last_name: string | null; company: string | null;
    } | null;
    const clientName = client
      ? [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company || "a client"
      : "a client";

    await createNotificationService(inv.organization_id, {
      type: "invoice_overdue",
      title: `Invoice overdue: $${Number(inv.total).toFixed(2)}`,
      body: `Invoice ${inv.invoice_number} from ${clientName} is past due`,
      link: `/books/invoices/${inv.id}`,
    });
  }

  return NextResponse.json({ processed: overdueInvoices.length });
}
