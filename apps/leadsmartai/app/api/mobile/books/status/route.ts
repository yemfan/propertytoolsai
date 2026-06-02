import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { setInvoiceStatusForAgent, type InvoiceStatus } from "@/lib/books/invoices";

export const runtime = "nodejs";

/** POST /api/mobile/books/status — { id, status } mark sent/paid/void. */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, success: false, error: "id is required" }, { status: 400 });
    }
    const result = await setInvoiceStatusForAgent(auth.ctx.agentId, id, body.status as InvoiceStatus);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, success: false, error: result.error || "Could not update the invoice." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/books/status", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
