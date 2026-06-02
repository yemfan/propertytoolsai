import { NextResponse } from "next/server";
import { setInvoiceStatus, type InvoiceStatus } from "@/lib/books/invoices";

export const runtime = "nodejs";

/** Update an invoice's status (e.g. mark sent / paid / void). Agent-scoped. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Missing invoice id." }, { status: 400 });

    const result = await setInvoiceStatus(id, body.status as InvoiceStatus);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update the invoice.";
    console.error("books/invoices/status POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
