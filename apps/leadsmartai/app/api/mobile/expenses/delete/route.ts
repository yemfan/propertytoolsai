import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { deleteExpenseForAgent } from "@/lib/books/expenses";

export const runtime = "nodejs";

/** Delete one of the authenticated agent's expenses. */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, success: false, error: "id is required" }, { status: 400 });
    }
    const result = await deleteExpenseForAgent(auth.ctx.agentId, id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/expenses/delete", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
