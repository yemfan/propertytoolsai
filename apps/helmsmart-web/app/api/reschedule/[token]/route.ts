/**
 * POST /api/reschedule/[token]
 *
 * Public endpoint — no auth (the reschedule_token is the capability token).
 * Accepts { start: ISO } and moves the appointment to that time.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rescheduleAppointment } from "@/lib/booking";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let start = "";
  try {
    const body = await request.json();
    start = String(body.start ?? "");
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  if (!start) return new NextResponse("Missing start time", { status: 400 });

  const supabase = await createServiceClient();
  const { data: ev } = await supabase
    .from("events")
    .select("organization_id")
    .eq("reschedule_token", token)
    .eq("type", "appointment")
    .maybeSingle();
  if (!ev) return new NextResponse("Not found", { status: 404 });

  const res = await rescheduleAppointment(ev.organization_id as string, { token, startISO: start });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.reason }, { status: 409 });
  return NextResponse.json({ ok: true, label: res.label });
}
