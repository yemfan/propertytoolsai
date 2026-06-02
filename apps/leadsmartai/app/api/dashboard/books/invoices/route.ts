import { NextResponse } from "next/server";
import { createInvoice, type InvoiceLineInput } from "@/lib/books/invoices";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { userHasCrmFeature, subscriptionRequiredResponse } from "@/lib/billing/subscriptionAccess";

export const runtime = "nodejs";

/** Create a draft invoice for the signed-in agent. */
export async function POST(req: Request) {
  try {
    const { userId } = await getCurrentAgentContext();
    if (!(await userHasCrmFeature(userId, "bookkeeping"))) {
      return subscriptionRequiredResponse("bookkeeping");
    }
    const body = (await req.json().catch(() => ({}))) as {
      contactId?: string | null;
      clientName?: string;
      clientEmail?: string;
      dueDate?: string | null;
      taxRate?: number;
      notes?: string;
      paymentUrl?: string;
      lines?: InvoiceLineInput[];
    };

    const result = await createInvoice({
      contactId: body.contactId ?? null,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      dueDate: body.dueDate ?? null,
      taxRate: body.taxRate,
      notes: body.notes,
      paymentUrl: body.paymentUrl,
      lines: Array.isArray(body.lines) ? body.lines : [],
    });

    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create the invoice.";
    console.error("books/invoices POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
