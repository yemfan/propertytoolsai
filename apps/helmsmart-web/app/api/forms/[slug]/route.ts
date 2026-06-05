/**
 * Public form submission handler
 * POST /api/forms/[slug]
 *
 * No authentication required — this is the public endpoint that embeds call.
 * Uses service role to bypass RLS for writing submissions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import twilio from "twilio";
import { notifySlackFormSubmission } from "@/lib/integrations/slack";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = await createServiceClient();

  try {
    const body = await request.json();

    // Find the form by slug — must search across all orgs since no auth context
    // The form's org_id is embedded in the form definition
    const { data: form } = await db
      .from("form_definitions")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (!form) {
      return NextResponse.json({ ok: false, error: "Form not found" }, { status: 404 });
    }

    // Extract name/email/phone from submission data for quick access
    const fields = (form.fields ?? []) as Array<{ id: string; type: string; label: string }>;
    const emailField = fields.find((f) => f.type === "email" || f.label.toLowerCase().includes("email"));
    const phoneField = fields.find((f) => f.type === "phone" || f.label.toLowerCase().includes("phone"));
    const nameField = fields.find(
      (f) => f.label.toLowerCase().includes("name") && !f.label.toLowerCase().includes("company")
    );

    const email = emailField ? (body[emailField.id] as string) || null : null;
    const phone = phoneField ? (body[phoneField.id] as string) || null : null;
    const name = nameField ? (body[nameField.id] as string) || null : null;

    // Validate required fields
    for (const field of fields) {
      if ((field as { required?: boolean }).required && !body[field.id]?.toString().trim()) {
        return NextResponse.json(
          { ok: false, error: `${field.label} is required` },
          { status: 400 }
        );
      }
    }

    // Auto-create/match client if enabled
    let clientId: string | null = null;
    if (form.auto_create_client && (email || phone)) {
      // Try to find existing client
      let clientQuery = db
        .from("clients")
        .select("id")
        .eq("organization_id", form.organization_id);

      if (email) {
        clientQuery = clientQuery.eq("email", email);
      } else if (phone) {
        clientQuery = clientQuery.eq("phone", phone);
      }

      const { data: existing } = await clientQuery.maybeSingle();

      if (existing) {
        clientId = existing.id;
      } else if (name || email) {
        // Create new lead
        const nameParts = (name ?? "").split(" ").filter(Boolean);
        const { data: newClient } = await db
          .from("clients")
          .insert({
            organization_id: form.organization_id,
            first_name: nameParts[0] ?? email?.split("@")[0] ?? "Lead",
            last_name: nameParts.slice(1).join(" ") || null,
            email: email || null,
            phone: phone || null,
            status: "lead",
            source: "form",
          })
          .select("id")
          .single();

        clientId = newClient?.id ?? null;
      }
    }

    // Record submission
    const { error: subError } = await db.from("form_submissions").insert({
      organization_id: form.organization_id,
      form_id: form.id,
      data: body,
      email,
      phone,
      name,
      client_id: clientId,
      ip_address: request.headers.get("x-forwarded-for") || null,
      user_agent: request.headers.get("user-agent") || null,
      referrer: request.headers.get("referer") || null,
    });

    if (subError) {
      console.error("[forms] submission insert error:", subError);
      return NextResponse.json({ ok: false, error: "Failed to save submission" }, { status: 500 });
    }

    // Increment submission count (best-effort)
    try {
      await db
        .from("form_definitions")
        .update({ submission_count: (form.submission_count ?? 0) + 1 })
        .eq("id", form.id);
    } catch {
      // Non-critical
    }

    // Notify via email
    const notifyEmail = form.notify_email;
    if (notifyEmail && resend) {
      const fieldLines = fields
        .map((f: { id: string; label: string }) => `<tr><td style="padding:4px 0;font-weight:bold;">${f.label}:</td><td style="padding:4px 8px;">${body[f.id] ?? "—"}</td></tr>`)
        .join("\n");

      await resend.emails.send({
        from: "HelmSmart Forms <forms@helmsmart.app>",
        to: notifyEmail,
        subject: `New form submission: ${form.title}`,
        html: `
          <h2 style="margin:0 0 16px">New submission: ${form.title}</h2>
          <table style="border-collapse:collapse;font-size:14px;">
            ${fieldLines}
          </table>
          <p style="margin-top:16px;color:#64748b;font-size:12px;">
            Submitted ${new Date().toLocaleString()} ·
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/forms/${form.id}/submissions">View in HelmSmart →</a>
          </p>
        `,
      }).catch((e) => console.error("[forms] email notify error:", e));
    }

    // Notify via Slack (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    void notifySlackFormSubmission(form.organization_id, {
      formTitle: form.title,
      name: name ?? undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      submissionsUrl: `${appUrl}/forms/${form.id}/submissions`,
      clientUrl: clientId ? `${appUrl}/clients/${clientId}` : undefined,
    });

    // Notify via SMS if enabled
    if (form.notify_sms) {
      const { data: org } = await db
        .from("organizations")
        .select("twilio_number")
        .eq("id", form.organization_id)
        .maybeSingle();

      if (org?.twilio_number && process.env.TWILIO_ACCOUNT_SID) {
        const twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        // Find owner's phone to notify
        const { data: ownerMember } = await db
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", form.organization_id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();

        if (ownerMember) {
          // Get owner's phone from auth users (not directly accessible via service role)
          // So we log it and skip the SMS for now
          console.log("[forms] SMS notify: owner not found for org", form.organization_id);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      successMessage: form.success_message,
      redirectUrl: form.redirect_url || null,
    });
  } catch (error) {
    console.error("[forms] submission error:", error);
    return NextResponse.json({ ok: false, error: "Submission failed" }, { status: 500 });
  }
}
