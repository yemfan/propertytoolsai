import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";
import { scheduleEmailSequenceForLead } from "@/lib/emailSequences";
import { recordLeadEvent, scoreLead } from "@/lib/leadScoring";
import { runLeadMarketplacePipeline } from "@/lib/leadScorePipeline";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatUsPhone(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  intent?: string;
  property_address?: string;
  tool?: string;
  timeframe?: string;
  location?: string;
  property_value?: number;
};

/**
 * Tool funnel lead capture — maps into existing CRM `leads` row shape.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phoneRaw = String(body.phone ?? "").trim();
    const source = String(body.source ?? "tool_capture").trim() || "tool_capture";
    const intent = String(body.intent ?? "sell").trim() || "sell";
    const propertyAddress = String(body.property_address ?? "").trim();
    const tool = String(body.tool ?? "").trim();
    const timeframe = String(body.timeframe ?? "").trim() || null;
    const location = String(body.location ?? "").trim() || null;
    const propertyValue =
      body.property_value != null && Number.isFinite(Number(body.property_value))
        ? Number(body.property_value)
        : null;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Name is required." },
        { status: 400 }
      );
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email is required." },
        { status: 400 }
      );
    }

    const formattedPhone = phoneRaw ? formatUsPhone(phoneRaw) : null;
    if (phoneRaw && !formattedPhone) {
      return NextResponse.json(
        { ok: false, error: "Phone must be a valid US 10-digit number." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("leads")
      .insert({
        agent_id: null,
        name,
        email,
        phone: formattedPhone ?? null,
        phone_number: formattedPhone ?? null,
        sms_opt_in: false,
        property_address: propertyAddress || null,
        source,
        traffic_source: tool ? `${source}:${tool}` : source,
        intent,
        tool_used: tool || null,
        timeframe,
        location,
        property_value: propertyValue,
        lead_quality: "high",
        lead_status: "new",
        notes: null,
        rating: "warm",
        contact_frequency: "weekly",
        contact_method: "email",
        next_contact_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("tool-capture insert error", error);
      return NextResponse.json(
        { ok: false, error: "Failed to save lead." },
        { status: 500 }
      );
    }

    const leadId = data?.id != null ? String(data.id) : null;

    if (leadId) {
      try {
        await scheduleEmailSequenceForLead(leadId);
        await recordLeadEvent({
          lead_id: leadId as any,
          event_type: "tool_lead_capture",
          metadata: { source, intent, tool, property_address: propertyAddress },
        });
        await runLeadMarketplacePipeline(leadId);
        await scoreLead(leadId, true);
      } catch (e) {
        console.warn("tool-capture post-insert hooks", e);
      }
    }

    const agentEmail = process.env.AGENT_NOTIFICATION_EMAIL;
    if (agentEmail) {
      try {
        await sendEmail({
          to: agentEmail,
          subject: "New PropertyTools AI tool lead",
          text: `New lead from tool capture:

Name: ${name}
Email: ${email}
Phone: ${formattedPhone ?? "(not provided)"}
Intent: ${intent}
Source: ${source}
Tool: ${tool || "(n/a)"}
Address: ${propertyAddress || "(not provided)"}
Time: ${new Date().toISOString()}`,
        });
      } catch (mailErr) {
        console.warn("tool-capture agent email failed", mailErr);
      }
    }

    return NextResponse.json({ ok: true, leadId });
  } catch (e: any) {
    console.error("POST /api/leads/tool-capture", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
