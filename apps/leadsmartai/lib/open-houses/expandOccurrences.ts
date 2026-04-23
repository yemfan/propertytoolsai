/**
 * Pure helpers for expanding a recurrence spec into specific
 * (startAt, endAt) ISO pairs. No DB, no I/O — easy to unit test.
 *
 * Two input shapes:
 *   - `weekly`: pick a day-of-week + time window + # of occurrences,
 *               starting from an anchor date.
 *   - `dates`:  pass an explicit list of date strings + one shared
 *               time window.
 *
 * Timezone handling: inputs are in the agent's local wall-clock
 * (implicit — we don't carry TZ in the schema). We treat each
 * `YYYY-MM-DD` + `HH:MM` pair as local time when building the Date,
 * then serialise to ISO UTC for storage. This matches what the
 * existing single-create flow does.
 */

export type WeeklyRecurrenceInput = {
  kind: "weekly";
  anchorDate: string; // YYYY-MM-DD — first occurrence
  weekdays: number[]; // 0=Sun, 1=Mon, ... 6=Sat. Usually length 1.
  weeks: number; // how many weeks to generate
  startTime: string; // HH:MM local (24h)
  endTime: string; // HH:MM local
};

export type DatesRecurrenceInput = {
  kind: "dates";
  dates: string[]; // YYYY-MM-DD list
  startTime: string; // HH:MM local
  endTime: string; // HH:MM local
};

export type RecurrenceInput = WeeklyRecurrenceInput | DatesRecurrenceInput;

export type Occurrence = { startAt: string; endAt: string };

const MAX_OCCURRENCES = 26;

export function expandOccurrences(input: RecurrenceInput): Occurrence[] {
  if (input.kind === "weekly") return expandWeekly(input);
  return expandDates(input);
}

function expandWeekly(input: WeeklyRecurrenceInput): Occurrence[] {
  const { anchorDate, weekdays, weeks, startTime, endTime } = input;
  if (!weekdays.length || weeks <= 0) return [];

  const anchor = parseYmd(anchorDate);
  if (!anchor) return [];

  const out: Occurrence[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const dow of weekdays) {
      const target = new Date(anchor);
      // Align anchor → first matching weekday this week, then walk forward.
      const offset = (dow - anchor.getDay() + 7) % 7;
      target.setDate(anchor.getDate() + offset + w * 7);
      const ymd = toYmd(target);
      const occ = buildOccurrence(ymd, startTime, endTime);
      if (occ) out.push(occ);
      if (out.length >= MAX_OCCURRENCES) return out;
    }
  }
  return out;
}

function expandDates(input: DatesRecurrenceInput): Occurrence[] {
  const out: Occurrence[] = [];
  for (const d of input.dates) {
    const occ = buildOccurrence(d, input.startTime, input.endTime);
    if (occ) out.push(occ);
    if (out.length >= MAX_OCCURRENCES) break;
  }
  return out;
}

function buildOccurrence(
  ymd: string,
  startTime: string,
  endTime: string,
): Occurrence | null {
  const startAt = combineLocal(ymd, startTime);
  const endAt = combineLocal(ymd, endTime);
  if (!startAt || !endAt) return null;
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return null;
  return { startAt, endAt };
}

function combineLocal(ymd: string, hhmm: string): string | null {
  const d = parseYmd(ymd);
  if (!d) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) {
    return null;
  }
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const out = new Date(y, mo - 1, d);
  if (
    out.getFullYear() !== y ||
    out.getMonth() !== mo - 1 ||
    out.getDate() !== d
  ) {
    return null;
  }
  return out;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
