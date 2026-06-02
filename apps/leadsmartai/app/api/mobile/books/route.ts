import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { listInvoicesForAgent } from "@/lib/books/invoices";
import type { MobileInvoiceDto, MobileInvoiceStatus } from "@leadsmart/shared";

export const runtime = "nodejs";

/** GET /api/mobile/books — the agent's invoices + outstanding/paid totals. */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const rows = await listInvoicesForAgent(auth.ctx.agentId, 200);
    const invoices: MobileInvoiceDto[] = rows.map((r) => ({
      id: String(r.id),
      invoice_number: r.invoice_number,
      status: r.status as MobileInvoiceStatus,
      client_name: r.client_name,
      client_email: r.client_email,
      total: Number(r.total),
      currency: r.currency || "USD",
      due_date: r.due_date,
      created_at: r.created_at,
    }));
    const outstanding = invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + i.total, 0);
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

    return NextResponse.json({ ok: true, success: true, invoices, outstanding, paid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/books", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
