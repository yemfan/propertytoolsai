/**
 * PropertyToolsAI consumer app (buyer/seller) — separate from LeadSmart (agents/CRM).
 * Used to redirect consumers who must not use authenticated LeadSmart surfaces.
 *
 * Env: `NEXT_PUBLIC_PROPERTYTOOLS_CONSUMER_URL` — origin only, no trailing slash
 * (e.g. `https://www.propertytoolsai.com`). Dev fallback: `http://localhost:3001`.
 */

export function getPropertyToolsConsumerBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_PROPERTYTOOLS_CONSUMER_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }
  return "https://www.propertytoolsai.com";
}

/** Logged-in consumer landing (matches `apps/propertytoolsai` hub). */
export function getPropertyToolsConsumerPostLoginPath(): string {
  return "/dashboard";
}

export function getPropertyToolsConsumerPostLoginUrl(): string {
  return `${getPropertyToolsConsumerBaseUrl()}${getPropertyToolsConsumerPostLoginPath()}`;
}

export function getPropertyToolsConsumerAccountProfileUrl(): string {
  return `${getPropertyToolsConsumerBaseUrl()}/account/profile`;
}
