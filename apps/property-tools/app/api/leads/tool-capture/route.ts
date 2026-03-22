import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";
import { scheduleEmailSequenceForLead } from "@/lib/emailSequences";
import { insertToolEvent } from "@/lib/homeValue/funnelPersistence";
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
  /** 0–100 — home value / tool confidence for routing */
  confidence_score?: number;
  /** 0–100 — funnel / engagement for LeadSmart routing */
  engagement_score?: number;
  /** Merged into `notes` as JSON for LeadSmart / CRM */
  metadata?: Record<string, unknown>;
  session_id?: string;
  full_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  estimate_low?: number;
  estimate_high?: number;
  confidence?: string;
  likely_intent?: string;
};

/**
 * Tool funnel lead capture — maps into existing CRM `leads` row shape.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phoneRaw = String(body.phone ?? "").trim();
    const source = String(body.source ?? "tool_capture").trim() || "tool_capture";
    const intent = String(body.intent ?? "sell").trim() || "sell";
    const propertyAddress = String(body.property_address ?? "").trim();
    const tool = String(body.tool ?? "").trim();
    const sessionId = String(body.session_id ?? "").trim() || null;
    const fullAddress =
      String(body.full_address ?? "").trim() || (propertyAddress || null);
    const city = body.city != null ? String(body.city).trim() || null : null;
    const state = body.state != null ? String(body.state).trim() || null : null;
    const zip = body.zip != null ? String(body.zip).trim() || null : null;
    const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : null;
    const estimateLow =
      body.estimate_low != null && Number.isFinite(Number(body.estimate_low))
        ? Number(body.estimate_low)
        : meta && "estimate_low" in meta && Number.isFinite(Number(meta.estimate_low))
          ? Number(meta.estimate_low)
          : null;
    const estimateHigh =
      body.estimate_high != null && Number.isFinite(Number(body.estimate_high))
        ? Number(body.estimate_high)
        : meta && "estimate_high" in meta && Number.isFinite(Number(meta.estimate_high))
          ? Number(meta.estimate_high)
          : null;
    const confidenceLabel =
      body.confidence != null && String(body.confidence).trim()
        ? String(body.confidence).trim()
        : meta && "confidence_level" in meta && meta.confidence_level != null
          ? String(meta.confidence_level)
          : null;
    const likelyIntent =
      body.likely_intent != null && String(body.likely_intent).trim()
        ? String(body.likely_intent).trim()
        : meta && "likely_intent" in meta && meta.likely_intent != null
          ? String(meta.likely_intent)
          : null;
    const timeframe = String(body.timeframe ?? "").trim() || null;
    const location = String(body.location ?? "").trim() || null;
    const propertyValue =
      body.property_value != null && Number.isFinite(Number(body.property_value))
        ? Number(body.property_value)
        : null;

    const confidenceScore =
      body.confidence_score != null && Number.isFinite(Number(body.confidence_score))
        ? Math.max(0, Math.min(100, Math.round(Number(body.confidence_score))))
        : null;

    let engagementScore =
      body.engagement_score != null && Number.isFinite(Number(body.engagement_score))
        ? Math.max(0, Math.min(100, Math.round(Number(body.engagement_score))))
        : null;

    const hasMeta =
      (body.metadata && typeof body.metadata === "object") ||
      confidenceScore != null ||
      propertyValue != null ||
      engagementScore != null;

    const metaNotes = hasMeta
      ? JSON.stringify({
          v: 1,
          tool: tool || "unknown",
          confidence_score: confidenceScore,
          engagement_score: engagementScore,
          property_value: propertyValue,
          leadsmart: {
            routing: "propertytools_tool_capture",
            ready_for_intelligence: true,
          },
          ...(typeof body.metadata === "object" && body.metadata ? body.metadata : {}),
        })
      : null;

    const leadQuality =
      engagementScore != null && confidenceScore != null
        ? engagementScore >= 65 && confidenceScore >= 55
          ? "high"
          : engagementScore >= 38
            ? "medium"
            : "low"
        : confidenceScore != null && confidenceScore >= 70
          ? "high"
          : "medium";

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
        session_id: sessionId,
        user_id: userId,
        full_address: fullAddress,
        city: city ?? undefined,
        state: state ?? undefined,
        zip: zip ?? undefined,
        estimated_value: propertyValue,
        estimate_low: estimateLow,
        estimate_high: estimateHigh,
        confidence: confidenceLabel,
        confidence_score: confidenceScore,
        likely_intent: likelyIntent,
        engagement_score: engagementScore ?? undefined,
        status: "new",
        source,
        traffic_source: tool ? `${source}:${tool}` : source,
        intent,
        tool_used: tool || null,
        timeframe,
        location,
        property_value: propertyValue,
        lead_quality: leadQuality,
        lead_status: "new",
        notes: metaNotes,
        rating: engagementScore != null && engagementScore >= 72 ? "hot" : "warm",
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

    if (sessionId) {
      try {
        await insertToolEvent({
          sessionId,
          userId,
          toolName: tool || "tool_capture",
          eventName: "lead_submitted",
          metadata: {
            lead_id: leadId,
            source,
            email_domain: email.includes("@") ? email.split("@")[1] : null,
          },
        });
      } catch (e) {
        console.warn("tool-capture tool_events", e);
      }
    }

    if (leadId) {
      try {
        await scheduleEmailSequenceForLead(leadId);
        await recordLeadEvent({
          lead_id: leadId as any,
          event_type: "tool_lead_capture",
          metadata: {
            source,
            intent,
            tool,
            property_address: propertyAddress,
            property_value: propertyValue,
            confidence_score: confidenceScore,
            engagement: body.metadata?.engagement,
            engagement_score: engagementScore,
            likely_intent: body.metadata?.likely_intent,
          },
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
