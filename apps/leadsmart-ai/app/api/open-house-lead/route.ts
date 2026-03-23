import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPropertyData } from "@/lib/getPropertyData";
import { scheduleEmailSequenceForLead } from "@/lib/emailSequences";
import { sendEmail } from "@/lib/email";
import { generateOpenHouseReportData } from "@/lib/openHouseReport";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `leads.agent_id` is bigint → `agents.id`. Query param is often auth UUID (`agents.auth_user_id`). */
async function resolveLeadsAgentId(raw: string): Promise<number | null> {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  if (UUID_RE.test(t)) {
    const { data, error } = await supabaseServer
      .from("agents")
      .select("id")
      .eq("auth_user_id", t)
      .maybeSingle();
    if (error || data?.id == null) return null;
    const id = typeof data.id === "number" ? data.id : Number(data.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      notes?: string;
      property_id?: string;
      agent_id?: string;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const notes = (body.notes ?? "").trim();
    const propertyId = (body.property_id ?? "").trim();
    const agentIdRaw = (body.agent_id ?? "").trim();
    const resolvedAgentId = await resolveLeadsAgentId(agentIdRaw);

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "property_id is required." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, message: "name is required." },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { success: false, message: "email is required." },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { success: false, message: "phone is required." },
        { status: 400 }
      );
    }

    // Resolve property_id to an address (warehouse rows drive estimator/CMA).
    const { data: propertyRow, error: propertyErr } = await supabaseServer
      .from("properties_warehouse")
      .select("id,address")
      .eq("id", propertyId)
      .maybeSingle();

    if (propertyErr || !propertyRow?.address) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Could not find the property for this signup link. Please request a new QR code.",
        },
        { status: 400 }
      );
    }

    // 1) Insert lead into existing CRM schema.
    //    NOTE: we keep this insert limited to columns that already exist to avoid
    //    breaking existing dashboard flows.
    const { data: lead, error: leadErr } = await supabaseServer
      .from("leads")
      .insert({
        name,
        email,
        phone,
        notes: notes ? notes : null,
        property_address: propertyRow.address,
        source: "Open House",
        lead_status: "new",
        agent_id: resolvedAgentId,
      })
      .select("id")
      .single();

    if (leadErr || !lead?.id) {
      const msg =
        (leadErr as { message?: string; details?: string })?.message ||
        (leadErr as { details?: string })?.details ||
        "Failed to create lead.";
      return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }

    const leadId = String(lead.id);

    // Best-effort: store the property_id on the lead if that column exists.
    // (We don't fail the request if the DB schema isn't fully deployed yet.)
    try {
      const { error: leadPropertyUpdateErr } = await supabaseServer
        .from("leads")
        .update({ property_id: propertyId })
        .eq("id", leadId);

      if (leadPropertyUpdateErr) {
        console.error("open-house-lead: lead property_id update failed", leadPropertyUpdateErr);
      }
    } catch (e) {
      console.error("open-house-lead: lead property_id update threw", e);
    }

    // 2) Fetch/refresh property data so we have latest snapshots (rent + estimated value).
    //    This also ensures the warehouse rows exist for comps generation.
    try {
      await getPropertyData(propertyRow.address, false);
    } catch (e) {
      console.error("open-house: getPropertyData refresh failed", e);
      // Continue with whatever snapshots/comps are already available.
    }

    // 3) Generate report data: estimated value + rent estimate + subject details + CMA comps.
    const reportData = await generateOpenHouseReportData({
      propertyId: String(propertyRow.id),
      address: propertyRow.address,
    });

    // 4) Save report to `reports` table.
    //    NOTE: `public.reports.lead_id` is uuid in older schemas; CRM `leads.id` is bigint.
    //    Omit lead_id here and link via `leads.report_id` below.
    const { data: report, error: reportErr } = await supabaseServer
      .from("reports")
      .insert({
        property_id: propertyId,
        lead_id: null,
        report_data: reportData,
      })
      .select("id")
      .single();

    if (reportErr || !report?.id) {
      const msg =
        (reportErr as { message?: string; details?: string })?.message ||
        (reportErr as { details?: string })?.details ||
        "Failed to create property report.";
      return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }

    const reportId = String(report.id);

    // 5) Store report_id back on the lead (optional, best-effort).
    try {
      const { error: leadReportUpdateErr } = await supabaseServer
        .from("leads")
        .update({ report_id: reportId })
        .eq("id", leadId);

      if (leadReportUpdateErr) {
        console.error("open-house-lead: lead report_id update failed", leadReportUpdateErr);
      }
    } catch (e) {
      console.error("open-house-lead: lead report_id update threw", e);
    }

    // 6) Send branded email to the visitor with the report link.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const reportLink = `${origin}/report/${encodeURIComponent(reportId)}`;

    const subject = "Thanks for visiting! Your Property Report Inside";
    const brandName = process.env.AGENT_BRAND_NAME || "LeadSmart AI";
    const emailText = `Hi ${name},

Thanks for visiting our open house!

Here’s your full property report:
👉 ${reportLink}

Includes:
- Estimated home value
- Market comparables
- Investment insights

Let me know if you have any questions!

Best,
${brandName}
Real Estate Advisor`;

    try {
      await sendEmail({
        to: email,
        subject,
        text: emailText,
      });
    } catch (e) {
      // Email delivery should never break lead capture.
      console.error("open-house: sendEmail failed", e);
    }

    // 7) Add lead to follow-up automation (best-effort — never fail signup).
    try {
      await scheduleEmailSequenceForLead(leadId);
    } catch (seqErr) {
      console.error("open-house: scheduleEmailSequenceForLead failed", seqErr);
    }

    // Optional SMS hook for later upgrades.
    // (No-op unless you implement an SMS provider.)
    // if (process.env.OPEN_HOUSE_SMS_ENABLED === "true") { ... }

    return NextResponse.json({
      success: true,
      message: "Thanks! Your property report has been generated and emailed to you.",
    });
  } catch (err) {
    console.error("open-house-lead error", err);
    return NextResponse.json(
      { success: false, message: "Server error submitting open house lead." },
      { status: 500 }
    );
  }
}

