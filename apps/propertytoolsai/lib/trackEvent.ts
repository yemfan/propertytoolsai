/**
 * Client-side behavioral event tracker. Fire-and-forget POST to
 * /api/events/track. The endpoint handles contact resolution from the
 * logged-in auth session or session cookie; the caller just passes
 * the event type + payload.
 *
 * Uses sendBeacon when available so events fire reliably even during
 * navigation (e.g., clicking "View Details" on a listing — the next-
 * page navigation would normally cancel a pending fetch). Falls back
 * to fetch with keepalive for browsers without sendBeacon.
 */

export type TrackEventPayload = Record<string, unknown>;

export function trackEvent(eventType: string, payload?: TrackEventPayload) {
  try {
    const body = JSON.stringify({ eventType, payload });
    // Prefer sendBeacon: survives page unload, doesn't block navigation.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/events/track", blob);
      return;
    }
    // Fallback: fetch with keepalive flag (same intent as sendBeacon on
    // modern browsers that don't ship it).
    void fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // swallow — this is fire-and-forget
    });
  } catch {
    // swallow — client-side tracking must never break the page
  }
}
