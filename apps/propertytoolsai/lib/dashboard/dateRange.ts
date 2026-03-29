/** Inclusive UTC window from `?start=&end=` (`YYYY-MM-DD`) on dashboard APIs. */
export type DateRangeBounds = { startMs: number; endMs: number };

export function parseDateRangeQuery(start?: string, end?: string): DateRangeBounds | null {
  if (!start?.trim() || !end?.trim()) return null;
  const startMs = Date.parse(`${start.trim()}T00:00:00.000Z`);
  const endMs = Date.parse(`${end.trim()}T23:59:59.999Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return null;
  return { startMs, endMs };
}

export function timeMs(iso: string | null | undefined): number | null {
  if (iso == null || typeof iso !== "string") return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** True if any parsed timestamp falls inside [startMs, endMs]. */
export function anyTimestampInRange(
  values: Array<string | null | undefined>,
  range: DateRangeBounds
): boolean {
  for (const v of values) {
    const t = timeMs(v);
    if (t != null && t >= range.startMs && t <= range.endMs) return true;
  }
  return false;
}

export type DatePreset = "7d" | "30d" | "90d" | "mtd" | "custom";

export type DateRange = {
  start: string;
  end: string;
  preset: DatePreset;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolve a calendar range from a non-custom preset. For `custom`, pass explicit
 * `{ start, end }` in your UI and build `DateRange` yourself — this helper cannot infer bounds.
 */
export function getPresetDateRange(preset: DatePreset): DateRange {
  if (preset === "custom") {
    throw new Error(
      'getPresetDateRange: preset "custom" requires explicit start/end — build DateRange in the caller'
    );
  }

  const now = new Date();
  const end = toIsoDate(now);

  if (preset === "mtd") {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: toIsoDate(startDate),
      end,
      preset,
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);

  return {
    start: toIsoDate(startDate),
    end,
    preset,
  };
}
