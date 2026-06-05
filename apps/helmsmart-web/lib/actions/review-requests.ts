"use server";

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendReviewRequest } from "@/lib/integrations/review-request-email";

/**
 * Request a review from a client after their appointment is completed.
 * Can be triggered manually or automatically after appointments.
 */
export async function requestReviewFromClient(
  clientId: string,
  campaignName?: string
): Promise<{ ok: boolean; error?: string; requestId?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();

  // Get client contact info
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .eq("organization_id", orgId)
    .eq("id", clientId)
    .single();

  if (!client) return { ok: false, error: "Client not found" };
  if (!client.email && !client.phone) {
    return { ok: false, error: "Client has no email or phone number" };
  }

  // Get business profile with review link
  const { data: profile } = await supabase
    .from("google_business_profiles")
    .select("id, business_name, review_link")
    .eq("organization_id", orgId)
    .single();

  if (!profile || !profile.review_link) {
    return { ok: false, error: "Google Business Profile not connected" };
  }

  // Get org name for personalization
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  const orgName = org?.name ?? "our business";

  // Create review request record
  const db = await createServiceClient();
  const { data: request, error: insertErr } = await db
    .from("review_requests")
    .insert({
      organization_id: orgId,
      business_profile_id: profile.id,
      client_id: clientId,
      recipient_email: client.email,
      recipient_phone: client.phone,
      campaign_name: campaignName ?? "post-appointment",
      request_method: client.email ? "email" : "sms",
      request_link: profile.review_link,
      request_sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !request) {
    console.error("[review-requests] insert error:", insertErr);
    return { ok: false, error: "Failed to create review request" };
  }

  // Send review request (email or SMS)
  try {
    if (client.email) {
      await sendReviewRequest({
        clientName: [client.first_name, client.last_name].filter(Boolean).join(" ") || "there",
        clientEmail: client.email,
        businessName: profile.business_name || orgName,
        reviewLink: profile.review_link,
      });
    }
    // TODO: Add SMS review request for clients without email
  } catch (err) {
    console.error("[review-requests] send error:", err);
    // Don't fail the whole operation if email/SMS fails
  }

  revalidatePath("/google/reviews");
  return { ok: true, requestId: request.id };
}

/**
 * Auto-request reviews after an appointment is completed.
 * Called by the appointment completion flow.
 */
export async function autoRequestReviewAfterAppointment(
  appointmentId: string,
  clientId: string
): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();

  // Check if org has review requests enabled (new setting)
  const { data: org } = await supabase
    .from("organizations")
    .select("auto_request_reviews")
    .eq("id", orgId)
    .single();

  if (!org?.auto_request_reviews) {
    return { ok: true }; // Not enabled, silently skip
  }

  // Check if we've already sent a review request for this appointment
  const { data: existing } = await supabase
    .from("review_requests")
    .select("id")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("campaign_name", `appointment-${appointmentId}`)
    .single();

  if (existing) {
    return { ok: true }; // Already sent
  }

  // Send review request
  return requestReviewFromClient(clientId, `appointment-${appointmentId}`);
}

/**
 * Get pending review requests for a client (for follow-up)
 */
export async function getPendingReviewRequests(clientId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return [];

  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("review_requests")
    .select("*")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("reviewed", false)
    .order("request_sent_at", { ascending: false });

  return requests ?? [];
}
