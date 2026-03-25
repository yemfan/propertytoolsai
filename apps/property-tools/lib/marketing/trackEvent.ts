/**
 * Product analytics placeholders — wire to /api/analytics/track or your provider.
 * @example trackEvent("tool_click", { tool: "home_value" })
 */
export function trackEvent(name: string, payload?: Record<string, unknown>) {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.debug("[trackEvent]", name, payload ?? {});
  }

  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    eventType: name,
    metadata: { page: window.location.pathname, ...payload },
  });

  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    /* non-blocking */
  });
}
