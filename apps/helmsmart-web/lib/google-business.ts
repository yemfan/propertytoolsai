/**
 * Google Business Profile API integration
 * Manages OAuth tokens, API calls, and review sync for local business management
 */

import { createClient } from "@/lib/supabase/server";

export const GOOGLE_BUSINESS_SCOPES =
  "https://www.googleapis.com/auth/business.manage";

export function getGoogleBusinessConfig() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-business/callback`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return { clientId, clientSecret, redirectUri, baseUrl };
}

export function isGoogleBusinessConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleBusinessConfig();
  return !!(clientId && clientSecret);
}

/**
 * Get the OAuth token for an organization's Google Business Profile
 */
export async function getGoogleBusinessToken(
  orgId: string
): Promise<{ accessToken: string; expiresAt: string | null } | null> {
  const supabase = await createClient();

  const { data: token, error } = await supabase
    .from("org_oauth_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("organization_id", orgId)
    .eq("provider", "google_business")
    .single();

  if (error || !token) return null;

  // If token expired, attempt refresh (best-effort)
  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    if (token.refresh_token) {
      const refreshed = await refreshGoogleBusinessToken(orgId, token.refresh_token);
      if (refreshed) return refreshed;
    }
    return null;
  }

  return {
    accessToken: token.access_token,
    expiresAt: token.expires_at,
  };
}

/**
 * Refresh an expired Google Business token using the refresh token
 */
async function refreshGoogleBusinessToken(
  orgId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string | null } | null> {
  const { clientId, clientSecret } = getGoogleBusinessConfig();

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("[google-business] refresh failed:", res.statusText);
      return null;
    }

    const data = await res.json();
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    // Update token in database
    const supabase = await createClient();
    await supabase
      .from("org_oauth_tokens")
      .update({
        access_token: data.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("provider", "google_business");

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (err) {
    console.error("[google-business] refresh error:", err);
    return null;
  }
}

/**
 * Sync reviews from Google Business Profile
 * Fetches the latest reviews and stores them in the database
 */
export async function syncGoogleBusinessReviews(
  orgId: string,
  businessLocationId: string
): Promise<{ synced: number; error?: string }> {
  const token = await getGoogleBusinessToken(orgId);
  if (!token) {
    return { synced: 0, error: "No Google Business token found" };
  }

  try {
    // Google Business Profile API: list reviews for a location
    const reviewsUrl = `https://mybusiness.googleapis.com/v4/${businessLocationId}/reviews`;

    const res = await fetch(reviewsUrl, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("[google-business] reviews fetch failed:", res.status, error);
      return { synced: 0, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const reviews = data.reviews ?? [];

    // Store/update reviews in database
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("google_business_profiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("business_location_id", businessLocationId)
      .single();

    if (!profile) {
      return { synced: 0, error: "Business profile not found" };
    }

    let synced = 0;
    for (const review of reviews) {
      const sentiment =
        review.rating >= 4 ? "positive" : review.rating >= 3 ? "neutral" : "negative";

      const { error: insertErr } = await supabase.from("google_reviews").upsert(
        {
          organization_id: orgId,
          business_profile_id: profile.id,
          review_id: review.reviewId,
          reviewer_name: review.reviewer?.displayName || "Anonymous",
          reviewer_email: review.reviewer?.emailAddress || null,
          rating: review.rating,
          review_text: review.reviewReply?.comment || review.comment || null,
          review_link: review.reviewLink,
          review_created_at: new Date(review.createTime).toISOString(),
          review_updated_at: review.updateTime ? new Date(review.updateTime).toISOString() : null,
          response_status: review.reviewReply ? "replied" : "unreplied",
          response_text: review.reviewReply?.comment || null,
          responded_at: review.reviewReply ? new Date(review.reviewReply.updateTime).toISOString() : null,
          sentiment,
        },
        { onConflict: "organization_id,review_id" }
      );

      if (!insertErr) synced++;
    }

    // Update profile with latest sync info
    await supabase
      .from("google_business_profiles")
      .update({
        review_count: reviews.length,
        last_synced_at: new Date().toISOString(),
        sync_status: "success",
        sync_error: null,
      })
      .eq("id", profile.id);

    return { synced };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[google-business] sync error:", err);
    return { synced: 0, error: msg };
  }
}

/**
 * Post a reply to a review on Google Business Profile
 */
export async function replyToGoogleReview(
  orgId: string,
  businessLocationId: string,
  reviewId: string,
  replyText: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getGoogleBusinessToken(orgId);
  if (!token) {
    return { ok: false, error: "No Google Business token found" };
  }

  try {
    const url = `https://mybusiness.googleapis.com/v4/${businessLocationId}/reviews/${reviewId}/reply`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: replyText,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("[google-business] reply failed:", res.status, error);
      return { ok: false, error: `API error: ${res.status}` };
    }

    // Update local database
    const supabase = await createClient();
    await supabase
      .from("google_reviews")
      .update({
        response_status: "replied",
        response_text: replyText,
        responded_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("review_id", reviewId);

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[google-business] reply error:", err);
    return { ok: false, error: msg };
  }
}
