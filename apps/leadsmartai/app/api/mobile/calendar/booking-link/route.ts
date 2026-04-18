import { NextResponse } from "next/server";
import { createMobileBookingLink } from "@/lib/mobile/calendarMobile";
import { requireMobileAgent } from "@/lib/mobile/auth";

export const runtime = "nodejs";

type PostBody = {
  contact_id?: string;
  booking_url?: string;
  label?: string | null;
  share_message?: string | null;
  expires_at?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const leadId = String(body.contact_id ?? "").trim();
    const bookingUrl = String(body.booking_url ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, success: false, error: "lead_id is required" }, { status: 400 });
    }
    if (!bookingUrl) {
      return NextResponse.json({ ok: false, success: false, error: "booking_url is required" }, { status: 400 });
    }

    const link = await createMobileBookingLink({
      agentId: auth.ctx.agentId,
      leadId,
      bookingUrl,
      label: body.label,
      shareMessage: body.share_message,
      expiresAt: body.expires_at,
    });

    return NextResponse.json({ ok: true, success: true, booking_link: link });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    if (msg === "INVALID_URL") {
      return NextResponse.json({ ok: false, success: false, error: "booking_url is required" }, { status: 400 });
    }
    console.error("POST /api/mobile/calendar/booking-link", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
