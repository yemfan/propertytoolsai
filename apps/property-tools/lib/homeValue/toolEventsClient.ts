"use client";

/**
 * POST /api/events — session-scoped funnel analytics (`tool_events`).
 */
export async function trackToolEvent(
  sessionId: string,
  toolName: string,
  eventName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!sessionId) return;
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        tool_name: toolName,
        event_name: eventName,
        metadata: metadata ?? {},
      }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}
