import { NextResponse } from "next/server";
import { getCurrentBrokerContext } from "@/lib/loan-broker/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const PIPELINE_STAGES = ["inquiry", "pre_qualification", "application", "processing", "underwriting", "closing", "funded"];

export async function GET(req: Request) {
  try {
    const { brokerId } = await getCurrentBrokerContext();
    const url = new URL(req.url);
    const stage = url.searchParams.get("stage") ?? "";
    const search = url.searchParams.get("search") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Number(url.searchParams.get("pageSize") ?? "50"));

    let q = supabaseServer
      .from("loan_applications")
      .select("*", { count: "exact" })
      .eq("assigned_broker_id", brokerId)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (stage && PIPELINE_STAGES.includes(stage)) {
      q = q.eq("pipeline_stage", stage);
    }

    if (search.trim()) {
      q = q.or(`borrower_name.ilike.%${search.trim()}%,borrower_email.ilike.%${search.trim()}%,property_address.ilike.%${search.trim()}%`);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      applications: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (e: any) {
    if (e?.message === "Not authenticated" || e?.message === "Not a loan broker") {
      return NextResponse.json({ ok: false, error: e.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { brokerId } = await getCurrentBrokerContext();
    const body = await req.json();

    const { data, error } = await supabaseServer
      .from("loan_applications")
      .insert({
        assigned_broker_id: brokerId,
        borrower_name: body.borrower_name || "New Borrower",
        borrower_email: body.borrower_email || null,
        borrower_phone: body.borrower_phone || null,
        property_address: body.property_address || null,
        loan_amount: body.loan_amount || null,
        loan_type: body.loan_type || "conventional",
        loan_purpose: body.loan_purpose || "purchase",
        interest_rate: body.interest_rate || null,
        loan_term_years: body.loan_term_years || 30,
        pipeline_stage: "inquiry",
        source: body.source || "manual",
        notes: body.notes || null,
        status: "active",
        readiness: "new",
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, application: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
