import { NextResponse } from "next/server";
import { createMobileBookingLink } from "@/lib/mobile/calendarMobile";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

type PostBody = {
  leadId?: string;
  bookingUrl?: string;
  label?: string | null;
  shareMessage?: string | null;
  expiresAt?: string | null;
};

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const leadId = String(body.leadId ?? "").trim();
    const bookingUrl = String(body.bookingUrl ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
    }
    if (!bookingUrl) {
      return NextResponse.json({ ok: false, error: "bookingUrl is required" }, { status: 400 });
    }

    const booking_link = await createMobileBookingLink({
      agentId,
      leadId,
      bookingUrl,
      label: body.label,
      shareMessage: body.shareMessage,
      expiresAt: body.expiresAt,
    });

    return NextResponse.json({ ok: true, booking_link });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }
    if (msg === "INVALID_URL") {
      return NextResponse.json({ ok: false, error: "bookingUrl is required" }, { status: 400 });
    }
    console.error("dashboard booking-link POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
