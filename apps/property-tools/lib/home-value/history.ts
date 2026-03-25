import type { AddressSelection } from "./types";

export type HomeValueHistoryItem = {
  sessionId: string;
  address: AddressSelection;
  savedAt: string;
  estimateValue?: number;
  rangeLow?: number;
  rangeHigh?: number;
  confidence?: "low" | "medium" | "high";
};

const STORAGE_KEY = "home_value_recent_history";
const MAX_ITEMS = 8;

export function getHomeValueHistory(): HomeValueHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HomeValueHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHomeValueHistory(item: HomeValueHistoryItem) {
  if (typeof window === "undefined") return;

  const current = getHomeValueHistory();
  const deduped = current.filter((x) => x.sessionId !== item.sessionId);
  const next = [item, ...deduped].slice(0, MAX_ITEMS);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearHomeValueHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
