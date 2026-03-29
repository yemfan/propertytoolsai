import { NextResponse } from "next/server";
import {
  roleMatchesFilter,
  subscriptionRowToBillingRecord,
  type BillingSubscriptionRow,
} from "@/lib/admin/billingRecords";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const role = searchParams.get("role")?.trim();

    let query = supabaseAdmin
      .from("billing_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data ?? []) as BillingSubscriptionRow[];
    let records = rows.map((row) => subscriptionRowToBillingRecord(row));

    if (role && role !== "all") {
      if (role === "consumer" || role === "agent" || role === "loan_broker") {
        records = records.filter((r) => roleMatchesFilter(r.role, role));
      } else {
        records = records.filter((r) => r.role.toLowerCase() === role.toLowerCase());
      }
    }

    return NextResponse.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to load billing records" },
      { status: 500 }
    );
  }
}
