import { NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/lib/books/invoices";

export const runtime = "nodejs";

/** Email an invoice to its client and mark it sent. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Missing invoice id." }, { status: 400 });

    const result = await sendInvoiceEmail(id);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send the invoice.";
    console.error("books/invoices/send POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
