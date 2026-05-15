import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPropertyData } from "@/lib/getPropertyData";
import { scheduleEmailSequenceForLead } from "@/lib/emailSequences";
import { sendEmail } from "@/lib/email";
import { generateOpenHouseReportData } from "@/lib/openHouseReport";
import {
  CONSENT_SOURCE_OPEN_HOUSE_SIGNUP,
  OPEN_HOUSE_SIGNUP_DISCLOSURE_VERSION,
} from "@/lib/consent/disclosureVersions";
import { extractRequestMeta } from "@/lib/consent/extractRequestMeta";
import { recordInboundContactRequest } from "@/lib/consent/service";

export const runtime = "nodejs";

/**
 * Default property address used when the signup form is submitted
 * without a `property_id` — i.e. the demo path TCR / A2P 10DLC
 * verifiers land on when they visit `/open-house-signup` directly
 * instead of via a QR code with `?property_id=...`.
 *
 * The submission still creates a contact + records consent (so the
 * audit row is real and verifiable) but the report-generation /
 * comps / email-with-report block is skipped because there's no
 * real warehouse row to drive it.
 */
const DEFAULT_DEMO_ADDRESS = "123 Main St, Los Angeles, CA 90001";

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
      smsConsent?: boolean;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const notes = (body.notes ?? "").trim();
    const propertyId = (body.property_id ?? "").trim();
    const agentIdRaw = (body.agent_id ?? "").trim();
    const resolvedAgentId = await resolveLeadsAgentId(agentIdRaw);
    const preferences = (body as any).preferences ?? null;
    const smsConsent = Boolean(body.smsConsent);

    // Demo / verifier path: a fresh visit without `property_id` is
    // allowed so TCR & other A2P 10DLC reviewers can land on a
    // working opt-in surface. The submission still records consent
    // and creates a lead — just skips the warehouse-driven report
    // generation that doesn't apply to a fake property.
    const isDemoSubmission = !propertyId;

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
    if (smsConsent && !phone) {
      return NextResponse.json(
        { success: false, message: "Provide a phone number to receive SMS, or untick SMS consent." },
        { status: 400 }
      );
    }

    // Resolve property_id to an address (warehouse rows drive
    // estimator/CMA). Skipped on the demo path — we use a fixed
    // default address and don't generate a report.
    let propertyAddress: string = DEFAULT_DEMO_ADDRESS;
    if (!isDemoSubmission) {
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
      propertyAddress = propertyRow.address as string;
    }

    // 1) Insert lead into existing CRM schema.
    //    NOTE: we keep this insert limited to columns that already exist to avoid
    //    breaking existing dashboard flows.
    const { data: lead, error: leadErr } = await supabaseServer
      .from("contacts")
      .insert({
        name,
        email,
        phone,
        notes: [
          notes,
          preferences?.want_more_info ? "Wants more info about property" : null,
          preferences?.want_similar_properties ? "Wants similar properties" : null,
          preferences?.want_home_valuation ? "Wants home valuation" : null,
          isDemoSubmission ? "Submitted from /open-house-signup demo path (no property_id)" : null,
        ].filter(Boolean).join(" | ") || null,
        property_address: propertyAddress,
        source: isDemoSubmission ? "Open House (demo)" : "Open House",
        lead_status: "new",
        agent_id: resolvedAgentId,
        // SMS opt-in is the load-bearing TCPA flag — only flip when
        // the visitor ticked the consent box. Audit row below stores
        // the disclosure version they saw.
        sms_opt_in: smsConsent,
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

    // Record proof-of-consent audit row immediately after the lead
    // create. Same audit table as /contact uses — TCR / carrier audits
    // can grep by `consent_disclosure_version` to retrieve the exact
    // wording the consenting party saw at submit time.
    //
    // Best-effort: a consent-table outage MUST NOT block the open
    // house lead capture. `recordInboundContactRequest` catches its
    // own errors and returns null on failure.
    try {
      const meta = extractRequestMeta(req);
      await recordInboundContactRequest({
        source: CONSENT_SOURCE_OPEN_HOUSE_SIGNUP,
        name: name || null,
        email: email || null,
        phone: phone || null,
        subject: isDemoSubmission ? "Open house signup (demo)" : "Open house signup",
        message: notes || null,
        smsConsent,
        emailConsent: null,
        consentDisclosureVersion: OPEN_HOUSE_SIGNUP_DISCLOSURE_VERSION,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        contactId: leadId,
      });
    } catch (e) {
      console.error("open-house-lead: consent audit write threw", e);
    }

    // Demo / verifier path stops here — no warehouse row, no comps
    // to generate, no property report to email. The contact is in
    // the CRM and the consent audit row is recorded; that's what TCR
    // is verifying.
    if (isDemoSubmission) {
      return NextResponse.json({
        success: true,
        message:
          "Thanks! We received your signup. (Demo open house — a real property report is generated when you sign up via a QR code at an actual open house.)",
      });
    }

    // Best-effort: store the property_id on the lead if that column exists.
    // (We don't fail the request if the DB schema isn't fully deployed yet.)
    try {
      const { error: leadPropertyUpdateErr } = await supabaseServer
        .from("contacts")
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
    //    NOTE: `public.reports.contact_id` is uuid in older schemas; CRM `leads.id` is bigint.
    //    Omit lead_id here and link via `leads.report_id` below.
    const { data: report, error: reportErr } = await supabaseServer
      .from("reports")
      .insert({
        property_id: propertyId,
        contact_id: null,
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
        .from("contacts")
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

