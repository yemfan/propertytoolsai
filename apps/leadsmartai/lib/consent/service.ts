import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Server-only persistence for the consent-audit table.
 *
 * The form route calls `recordInboundContactRequest` after validating
 * the submission. Best-effort: failures here MUST NOT block the
 * downstream email send — the audit row is the second-priority
 * artifact, the user-facing success path is the first. We log + swallow.
 */

export type RecordInboundContactRequestInput = {
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  smsConsent: boolean;
  /** Null when the form doesn't capture an email-consent toggle separately. */
  emailConsent: boolean | null;
  consentDisclosureVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Linked contact id when the form upserts into the CRM. Null when no
   *  contact is created (e.g. /contact form's email-only intake today). */
  contactId: string | null;
};

export async function recordInboundContactRequest(
  input: RecordInboundContactRequestInput,
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("inbound_contact_requests")
      .insert({
        source: input.source,
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.subject,
        message: input.message,
        sms_consent: input.smsConsent,
        email_consent: input.emailConsent,
        consent_disclosure_version: input.consentDisclosureVersion,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
        contact_id: input.contactId,
      } as never)
      .select("id")
      .single();
    if (error || !data) {
      console.error(
        "[consent.recordInboundContactRequest] insert failed:",
        error?.message,
      );
      return null;
    }
    return { id: (data as { id: string }).id };
  } catch (e) {
    console.error("[consent.recordInboundContactRequest] threw:", e);
    return null;
  }
}
