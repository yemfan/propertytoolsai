/**
 * Client-side buffer of behavioral events for personalization (localStorage).
 * Server analytics still go through `trackEvent` / `/api/analytics/track`.
 */

export const BEHAVIOR_STORAGE_KEY = "propertytoolsai:behavior_events_v1";
const MAX_EVENTS = 120;

export type StoredBehaviorEvent = {
  type: string;
  ts: number;
  metadata: Record<string, unknown>;
};

function safeParse(raw: string | null): StoredBehaviorEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof (e as StoredBehaviorEvent).type === "string" &&
        typeof (e as StoredBehaviorEvent).ts === "number"
    ) as StoredBehaviorEvent[];
  } catch {
    return [];
  }
}

export function readBehaviorEvents(): StoredBehaviorEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(BEHAVIOR_STORAGE_KEY));
}

export function appendBehaviorEvent(event: Omit<StoredBehaviorEvent, "ts">): void {
  if (typeof window === "undefined") return;
  const next: StoredBehaviorEvent = { ...event, ts: Date.now() };
  const prev = readBehaviorEvents();
  const merged = [...prev, next].slice(-MAX_EVENTS);
  try {
    window.localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* quota / private mode */
  }
}

export function clearBehaviorEvents(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BEHAVIOR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
