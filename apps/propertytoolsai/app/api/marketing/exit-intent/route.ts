import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PropertyTools AI — exit-intent capture.
 * Offer: free home value report by email.
 * Logs a growth event and sends a Resend notification when configured.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      event?: string;
      source?: string;
      page_path?: string;
    };

    // Analytics-only ping (open event, no email)
    if (!body.email) {
      const pagePath = String(body.page_path ?? "/").trim() || "/";
      await supabaseServer
        .from("traffic_events")
        .insert({
          event_type: "marketing_event",
          page_path: pagePath,
          source: "exit_intent",
          campaign: `exit_popup_${body.event ?? "open"}`,
          metadata: { source: body.source ?? "unknown" },
        } as Record<string, unknown>)
        .catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Valid email required." }, { status: 400 });
    }

    const pagePath = String(body.page_path ?? "/").trim() || "/";

    // Notify via Resend when configured
    const resendKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.AGENT_NOTIFICATION_EMAIL || "fan.yes@gmail.com";

    if (resendKey) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "PropertyTools AI <noreply@propertytoolsai.com>",
          to: [notifyTo],
          subject: "Exit popup: free home value report request",
          text: `Someone requested a free home value report via the exit-intent popup.\n\nEmail: ${email}\nPage: ${pagePath}\nTime: ${new Date().toISOString()}`,
        }),
      }).catch((e) => console.error("[exit-intent] Resend error", e));
    } else {
      console.log("[pt-exit-intent] RESEND_API_KEY not set; email:", email);
    }

    // Log growth event
    await supabaseServer
      .from("traffic_events")
      .insert({
        event_type: "conversion",
        page_path: pagePath,
        source: "marketing",
        campaign: "exit_popup_home_value_report",
        metadata: {
          email_hint: `${email.slice(0, 3)}***`,
          offer: "free_home_value_report",
        },
      } as Record<string, unknown>)
      .catch((e: unknown) => console.warn("[exit-intent] traffic_events:", (e as Error).message));

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
