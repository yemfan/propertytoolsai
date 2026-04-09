import { NextResponse } from "next/server";
import { getCurrentBrokerContext } from "@/lib/loan-broker/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { brokerId } = await getCurrentBrokerContext();
    const { id } = await ctx.params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    if (body.pipeline_stage) patch.pipeline_stage = body.pipeline_stage;
    if (body.borrower_name !== undefined) patch.borrower_name = body.borrower_name;
    if (body.borrower_email !== undefined) patch.borrower_email = body.borrower_email;
    if (body.borrower_phone !== undefined) patch.borrower_phone = body.borrower_phone;
    if (body.property_address !== undefined) patch.property_address = body.property_address;
    if (body.loan_amount !== undefined) patch.loan_amount = body.loan_amount;
    if (body.loan_type !== undefined) patch.loan_type = body.loan_type;
    if (body.loan_purpose !== undefined) patch.loan_purpose = body.loan_purpose;
    if (body.interest_rate !== undefined) patch.interest_rate = body.interest_rate;
    if (body.loan_term_years !== undefined) patch.loan_term_years = body.loan_term_years;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.status !== undefined) patch.status = body.status;
    if (body.last_contacted_at !== undefined) patch.last_contacted_at = body.last_contacted_at;
    if (body.next_follow_up_at !== undefined) patch.next_follow_up_at = body.next_follow_up_at;

    patch.updated_at = new Date().toISOString();

    const { error } = await supabaseServer
      .from("loan_applications")
      .update(patch)
      .eq("id", id)
      .eq("assigned_broker_id", brokerId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { brokerId } = await getCurrentBrokerContext();
    const { id } = await ctx.params;

    const { error } = await supabaseServer
      .from("loan_applications")
      .delete()
      .eq("id", id)
      .eq("assigned_broker_id", brokerId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
