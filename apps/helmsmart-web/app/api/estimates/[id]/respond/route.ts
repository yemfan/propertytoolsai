/**
 * POST /api/estimates/[id]/respond
 *
 * Public endpoint — no auth required (UUID is capability token).
 * Accepts { status: "accepted" | "declined" } and updates the estimate.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let status: string;
  try {
    const body = await request.json();
    status = body.status;
    if (!["accepted", "declined"].includes(status)) {
      return new NextResponse("Invalid status", { status: 400 });
    }
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify estimate exists and is in a respondable state
  const { data: est } = await supabase
    .from("estimates")
    .select("id, status, expiry_date")
    .eq("id", id)
    .single();

  if (!est) return new NextResponse("Not found", { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  if (est.expiry_date < today) {
    return new NextResponse("Estimate has expired", { status: 410 });
  }
  if (!["draft", "sent"].includes(est.status)) {
    return new NextResponse(`Estimate is already ${est.status}`, { status: 409 });
  }

  const { error } = await supabase
    .from("estimates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
