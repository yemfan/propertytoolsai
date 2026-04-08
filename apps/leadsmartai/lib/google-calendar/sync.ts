import { supabaseServer } from "@/lib/supabaseServer";
import { getGoogleOAuthConfig } from "./config";

type OAuthToken = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

/**
 * Get a valid access token for an agent, refreshing if expired.
 */
async function getValidToken(agentId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("agent_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("agent_id", agentId as any)
    .eq("provider", "google")
    .maybeSingle();

  if (!data) return null;
  const token = data as unknown as OAuthToken;

  // Check if token is expired
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now() + 60_000) {
    if (!token.refresh_token) return null;

    // Refresh the token
    const { clientId, clientSecret } = getGoogleOAuthConfig();
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const body = await res.json();
    if (!res.ok || !body.access_token) return null;

    const newExpires = body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000).toISOString()
      : null;

    await supabaseServer
      .from("agent_oauth_tokens")
      .update({
        access_token: body.access_token,
        expires_at: newExpires,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", agentId as any)
      .eq("provider", "google");

    return body.access_token;
  }

  return token.access_token;
}

/**
 * Create or update an event in Google Calendar.
 */
export async function syncEventToGoogle(params: {
  agentId: string;
  eventId: string;
  title: string;
  description?: string;
  startAt: string; // ISO
  endAt: string; // ISO
  timezone?: string;
}): Promise<{ googleEventId: string | null }> {
  const accessToken = await getValidToken(params.agentId);
  if (!accessToken) return { googleEventId: null };

  // Check if event already has a Google event ID
  const { data: existing } = await supabaseServer
    .from("lead_calendar_events")
    .select("external_event_id")
    .eq("id", params.eventId)
    .maybeSingle();

  const googleEventId = (existing as any)?.external_event_id;
  const tz = params.timezone || "America/Los_Angeles";

  const eventBody = {
    summary: params.title,
    description: params.description || "",
    start: { dateTime: params.startAt, timeZone: tz },
    end: { dateTime: params.endAt, timeZone: tz },
    reminders: { useDefault: true },
  };

  let method: string;
  let url: string;

  if (googleEventId) {
    // Update existing
    method = "PUT";
    url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`;
  } else {
    // Create new
    method = "POST";
    url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!res.ok) {
    console.error("Google Calendar sync error:", res.status, await res.text().catch(() => ""));
    return { googleEventId: googleEventId || null };
  }

  const result = await res.json();
  const newGoogleEventId = result.id || googleEventId;

  // Save the Google event ID back to our DB
  if (newGoogleEventId && newGoogleEventId !== googleEventId) {
    await supabaseServer
      .from("lead_calendar_events")
      .update({
        external_event_id: newGoogleEventId,
        calendar_provider: "google",
        external_calendar_id: "primary",
      } as any)
      .eq("id", params.eventId);
  }

  return { googleEventId: newGoogleEventId };
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteGoogleEvent(params: {
  agentId: string;
  googleEventId: string;
}): Promise<void> {
  const accessToken = await getValidToken(params.agentId);
  if (!accessToken) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${params.googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(() => {});
}

/**
 * Check if an agent has Google Calendar connected.
 */
export async function isGoogleCalendarConnected(agentId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("agent_oauth_tokens")
    .select("id")
    .eq("agent_id", agentId as any)
    .eq("provider", "google")
    .maybeSingle();
  return Boolean(data);
}
