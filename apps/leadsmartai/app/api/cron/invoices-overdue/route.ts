import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Daily cron — flip "sent" invoices to "overdue" once past their due date.
 *
 * Auth: Vercel's x-vercel-cron-signature (set automatically) OR
 * Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>.
 * Manual: curl "$URL/api/cron/invoices-overdue?secret=$CRON_SECRET"
 */
function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron-signature")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if ((req.headers.get("authorization") ?? "") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .eq("status", "sent")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .select("id");

  if (error) {
    console.error("[cron] invoices-overdue:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, markedOverdue: (data ?? []).length });
}
