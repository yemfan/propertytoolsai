import { NextResponse } from "next/server";
import { deleteExpense } from "@/lib/books/expenses";
import { requireCrmFeature } from "@/lib/billing/guard";

export const runtime = "nodejs";

/** Delete one of the signed-in agent's expenses. */
export async function POST(req: Request) {
  try {
    const gate = await requireCrmFeature("bookkeeping");
    if (!gate.ok) return gate.response;
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Missing expense id." }, { status: 400 });
    const result = await deleteExpense(id);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete the expense.";
    console.error("books/expenses/delete POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
