import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/twilioSms";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "send-test is disabled in production." },
        { status: 200 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      message?: string;
      leadId?: string | number;
    };

    const to = String(body.to ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!to || !message) {
      return NextResponse.json({ ok: false, error: "to and message are required." }, { status: 200 });
    }

    const leadId = body.leadId;
    const res = await sendSMS(to, message, leadId);

    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Server error",
        envDebug: {
          twilioAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
          twilioAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
          twilioFromNumber: Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER),
          resendApiKey: Boolean(process.env.RESEND_API_KEY),
          stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
        },
      },
      { status: 200 }
    );
  }
}

