import { NextResponse } from "next/server";
import { buildInvoicePdf } from "@/lib/books/invoices";
import { requireCrmFeature } from "@/lib/billing/guard";

export const runtime = "nodejs";

/** Stream an invoice as a PDF for viewing/saving. ?id=<invoiceId>, agent-scoped. */
export async function GET(req: Request) {
  try {
    const gate = await requireCrmFeature("bookkeeping");
    if (!gate.ok) return gate.response;
    const id = new URL(req.url).searchParams.get("id")?.trim() || "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing invoice id." }, { status: 400 });

    const result = await buildInvoicePdf(id);
    if (!result) return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });

    return new NextResponse(Buffer.from(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Invoice-${result.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("books/invoices/pdf", e);
    return NextResponse.json({ ok: false, error: "Could not generate the PDF." }, { status: 500 });
  }
}
