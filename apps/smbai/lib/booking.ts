import { createServiceClient } from "@/lib/supabase/server";
import { getGoogleFreeBusy, upsertGoogleEvent, type BusyInterval } from "@/lib/google-calendar";
import { DAY_KEYS, type BusinessHours, type DayKey } from "@/lib/receptionist";

// The receptionist's booking engine: availability (business hours ∩ free/busy)
// and conflict-safe booking. Service-client based — runs in the voice webhook.

const DEFAULT_TZ = "America/New_York";
const SLOT_STEP_MS = 30 * 60_000;

/** Offset (ms) of `timeZone` at instant `at`, DST-aware (no external lib). */
function tzOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) m[p.type] = p.value;
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return asUtc - at.getTime();
}

/** Wall-clock date+time in `timeZone` → UTC Date. */
function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  return new Date(naive.getTime() - tzOffsetMs(timeZone, naive));
}

function weekdayKey(dateStr: string): DayKey {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  return day === 0 ? "sun" : DAY_KEYS[day - 1];
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Drop ":00" on whole-hour times so the agent says "eleven AM", not the
 *  literal "eleven zero zero AM" that text-to-speech reads from "11:00 AM". */
const speakTime = (label: string) => label.replace(/:00(\s*[AP]M)/, "$1");

/** Add `days` to a YYYY-MM-DD calendar date (UTC-anchored, tz-neutral). */
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Best-effort: turn whatever the agent passes into a YYYY-MM-DD calendar date.
 * The LLM is told to send YYYY-MM-DD, but in practice it also sends weekday
 * names ("Monday"), relative terms ("tomorrow"), and natural dates
 * ("June 1, 2026"). Anything but strict ISO used to hit `new Date("Monday"…)`
 * → NaN → falsely "closed", so availability silently failed. Falls back to
 * `todayISO` when truly unparseable.
 */
export function normalizeDateStr(input: string, todayISO: string): string {
  const s = (input || "").trim();
  if (!s) return todayISO;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const lower = s.toLowerCase();
  if (lower === "today" || lower === "now") return todayISO;
  if (lower === "tomorrow") return addDaysISO(todayISO, 1);
  if (lower === "day after tomorrow" || lower === "overmorrow") return addDaysISO(todayISO, 2);

  // Weekday name (optionally "next …"): soonest date on/after today that matches.
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`(^|\\b)(next\\s+)?${d}(\\b|$)`).test(lower));
  if (wd >= 0) {
    const todayDow = new Date(`${todayISO}T12:00:00Z`).getUTCDay();
    let delta = (wd - todayDow + 7) % 7;
    if (delta === 0 && /\bnext\b/.test(lower)) delta = 7; // "next Monday" while it's Monday
    return addDaysISO(todayISO, delta);
  }

  // Natural-language / numeric dates ("June 1, 2026", "06/01/2026", "Jun 1", "6/2").
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const md = `${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    // If the string has no explicit 4-digit year, `new Date` defaults to a bogus
    // (often past) year → every slot reads as "in the past". Anchor month/day to
    // the current year, rolling to next year if that date has already passed.
    if (!/\b\d{4}\b/.test(s)) {
      const curYear = parseInt(todayISO.slice(0, 4), 10);
      const thisYear = `${curYear}-${md}`;
      return thisYear >= todayISO ? thisYear : `${curYear + 1}-${md}`;
    }
    return `${parsed.getFullYear()}-${md}`;
  }

  return todayISO; // unparseable → today; the agent can re-ask
}

const WORD_HOURS: Record<string, number> = {
  twelve: 12, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
};

/** Parse a spoken/written time into "HH:MM" (24h). Handles digit forms
 *  ("10:00 AM", "10am", "2 pm", "5:30pm", "17:00", "10") AND spoken forms a
 *  voice caller actually uses ("eleven", "eleven thirty", "half past two",
 *  "quarter to twelve", "noon", "midnight"). Returns null if unparseable. */
function parseTimeToHHMM(input: string): string | null {
  const raw = (input || "").trim().toLowerCase().replace(/\./g, "");
  if (!raw) return null;
  if (raw === "noon" || raw === "midday") return "12:00";
  if (raw === "midnight") return "00:00";

  // Digit form first.
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    return h > 23 || min > 59 ? null : `${pad2(h)}:${pad2(min)}`;
  }

  // Spoken form: find the hour word, then minutes/meridiem modifiers.
  const hourWord = Object.keys(WORD_HOURS).find((w) => new RegExp(`\\b${w}\\b`).test(raw));
  if (!hourWord) return null;
  let h = WORD_HOURS[hourWord];

  let min = 0;
  if (/\b(thirty|half)\b/.test(raw)) min = 30;
  else if (/\bforty[\s-]?five\b/.test(raw)) min = 45;
  else if (/\b(fifteen|quarter)\b/.test(raw)) min = 15;

  if (min > 0 && /\bto\b/.test(raw)) { min = 60 - min; h = h === 1 ? 12 : h - 1; } // "quarter to twelve"

  if (/\bpm\b|afternoon|evening|tonight/.test(raw) && h < 12) h += 12;
  else if (/\bam\b|morning/.test(raw) && h === 12) h = 0;

  return h > 23 || min > 59 ? null : `${pad2(h)}:${pad2(min)}`;
}

/**
 * Resolve the appointment start instant (epoch ms) from whatever the agent sent.
 * Prefers an explicit ISO `startISO`; otherwise reconstructs from `dateStr` +
 * `timeStr` in the org timezone. The Retell function template sends date/time
 * (not a single ISO `start`), so this keeps booking working either way.
 */
export function resolveStartMs(
  startISO: string | undefined,
  dateStr: string | undefined,
  timeStr: string | undefined,
  timezone: string
): number | null {
  if (startISO) {
    const ms = new Date(startISO).getTime();
    if (!Number.isNaN(ms)) return ms; // already a clean ISO timestamp
  }
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  // Fall back to the start string for the date/time if those args are absent.
  const date = normalizeDateStr(dateStr || startISO || "", todayISO);
  const hhmm = parseTimeToHHMM(timeStr || startISO || "");
  if (!hhmm) return null;
  return zonedToUtc(date, hhmm, timezone).getTime();
}

function overlapsBusy(startMs: number, endMs: number, busy: BusyInterval[]): boolean {
  return busy.some((b) => startMs < new Date(b.end).getTime() && endMs > new Date(b.start).getTime());
}

async function loadOrg(orgId: string): Promise<{ timezone: string; hours: BusinessHours | null }> {
  const db = createServiceClient();
  const { data } = await db.from("organizations").select("timezone, business_hours").eq("id", orgId).single();
  return {
    timezone: (data?.timezone as string) || DEFAULT_TZ,
    hours: (data?.business_hours as BusinessHours | null) ?? null,
  };
}

async function findType(orgId: string, name: string): Promise<{ id: string; name: string; duration_minutes: number } | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("appointment_types")
    .select("id, name, duration_minutes")
    .eq("organization_id", orgId)
    .eq("active", true)
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string; duration_minutes: number } | null) ?? null;
}

/** Busy intervals from Google Calendar (if connected) else internal events. */
async function busyIntervals(orgId: string, startUtc: Date, endUtc: Date): Promise<BusyInterval[]> {
  const gcal = await getGoogleFreeBusy(orgId, startUtc.toISOString(), endUtc.toISOString());
  if (gcal !== null) return gcal;

  const db = createServiceClient();
  const { data } = await db
    .from("events")
    .select("start_at, end_at")
    .eq("organization_id", orgId)
    .gte("start_at", new Date(startUtc.getTime() - 6 * 3600_000).toISOString())
    .lt("start_at", endUtc.toISOString());
  return (data ?? []).map((e) => {
    const start = e.start_at as string;
    const end = (e.end_at as string | null) ?? new Date(new Date(start).getTime() + SLOT_STEP_MS).toISOString();
    return { start, end };
  });
}

export type AvailabilityResult = {
  closed: boolean;
  durationMinutes: number;
  slots: { startISO: string; label: string }[];
};

/** Open slots for an appointment type on a given date (YYYY-MM-DD). */
export async function getAvailability(orgId: string, appointmentTypeName: string, dateStr: string): Promise<AvailabilityResult> {
  const { timezone, hours } = await loadOrg(orgId);
  const type = await findType(orgId, appointmentTypeName);
  const duration = type?.duration_minutes ?? 30;

  // Normalize whatever the agent sent (weekday name, natural date, …) to a real
  // calendar date, then roll forward past closed days (weekends/holidays) to the
  // next open day so the caller is always offered real times.
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  let date = normalizeDateStr(dateStr, todayISO);

  let dayHours = hours?.[weekdayKey(date)] ?? null;
  for (let guard = 0; !dayHours && guard < 14; guard++) {
    date = addDaysISO(date, 1);
    dayHours = hours?.[weekdayKey(date)] ?? null;
  }
  if (!dayHours) return { closed: true, durationMinutes: duration, slots: [] };

  const openUtc = zonedToUtc(date, dayHours.open, timezone);
  const closeUtc = zonedToUtc(date, dayHours.close, timezone);
  const busy = await busyIntervals(orgId, openUtc, closeUtc);
  const now = Date.now();
  const durMs = duration * 60_000;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const slots: { startISO: string; label: string }[] = [];
  for (let t = openUtc.getTime(); t + durMs <= closeUtc.getTime(); t += SLOT_STEP_MS) {
    if (t < now) continue;
    if (overlapsBusy(t, t + durMs, busy)) continue;
    slots.push({ startISO: new Date(t).toISOString(), label: speakTime(fmt.format(new Date(t))) });
    if (slots.length >= 5) break;
  }
  return { closed: false, durationMinutes: duration, slots };
}

export type BookResult = { ok: boolean; reason?: string; startISO?: string; label?: string; eventId?: string; title?: string };

/** Book a specific slot — re-validates, writes to Google Calendar (if connected) + the internal calendar. */
export async function bookAppointment(
  orgId: string,
  input: {
    appointmentTypeName: string;
    startISO?: string;
    dateStr?: string;
    timeStr?: string;
    clientId?: string | null;
    callerName?: string | null;
  }
): Promise<BookResult> {
  const { timezone, hours } = await loadOrg(orgId);
  const type = await findType(orgId, input.appointmentTypeName);
  const duration = type?.duration_minutes ?? 30;

  let startMs = resolveStartMs(input.startISO, input.dateStr, input.timeStr, timezone);
  if (startMs === null || startMs < Date.now()) {
    return { ok: false, reason: "That time isn't valid or is in the past." };
  }

  // Keep appointments inside business hours. A closed-day request rolls forward to
  // the next open day (same as check_availability) so the booking lands on a real
  // open day; the time of day must then sit inside that day's open–close window.
  // (After-hours emergencies are handled live by the agent, not booked.)
  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  if (hours) {
    let dayHours = hours[weekdayKey(fmtDate(startMs))] ?? null;
    for (let guard = 0; !dayHours && guard < 14; guard++) {
      startMs += 24 * 60 * 60_000; // advance one day, keeping the time of day
      dayHours = hours[weekdayKey(fmtDate(startMs))] ?? null;
    }
    if (!dayHours) {
      return { ok: false, reason: "We're closed then. Offer a day within business hours." };
    }
    const slotDate = fmtDate(startMs);
    const openMs = zonedToUtc(slotDate, dayHours.open, timezone).getTime();
    const closeMs = zonedToUtc(slotDate, dayHours.close, timezone).getTime();
    if (startMs < openMs || startMs + duration * 60_000 > closeMs) {
      return { ok: false, reason: `That time is outside business hours (${dayHours.open}–${dayHours.close}). Offer a time within hours.` };
    }
  }
  const endMs = startMs + duration * 60_000;
  const title = `${type?.name ?? "Appointment"}${input.callerName ? ` — ${input.callerName}` : ""}`;
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(endMs).toISOString();
  const db = createServiceClient();
  const fmtLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  // Idempotency: the agent (or Retell) sometimes calls book_appointment more than
  // once in a call. If THIS caller already holds this exact slot, treat the repeat
  // as success rather than "that time was just taken".
  if (input.clientId) {
    const { data: dupe } = await db
      .from("events")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", input.clientId)
      .eq("start_at", startISO)
      .maybeSingle();
    if (dupe) return { ok: true, startISO, label: speakTime(fmtLabel.format(new Date(startMs))), eventId: dupe.id as string, title };
  }

  const busy = await busyIntervals(orgId, new Date(startMs - 1), new Date(endMs + 1));
  if (overlapsBusy(startMs, endMs, busy)) return { ok: false, reason: "That time was just taken." };

  // smbai's internal calendar first. The unique index on (organization_id,
  // start_at) for appointments makes a same-slot double-booking impossible even
  // under a race — the Retell agent fires book_appointment several times per call.
  // Insert before the Google sync so a race-loser doesn't orphan a Google event.
  const { data: evt, error: insErr } = await db
    .from("events")
    .insert({
      organization_id: orgId,
      client_id: input.clientId ?? null,
      title,
      type: "appointment",
      color: "indigo",
      start_at: startISO,
      end_at: endISO,
      all_day: false,
      completed: false,
    })
    .select("id")
    .single();

  if (insErr) {
    // 23505 = unique violation: a concurrent booking already took this exact slot.
    if (insErr.code === "23505") {
      const { data: held } = await db
        .from("events")
        .select("id, client_id")
        .eq("organization_id", orgId)
        .eq("type", "appointment")
        .eq("start_at", startISO)
        .maybeSingle();
      // Same caller racing themselves → return the booking they wanted (idempotent).
      if (held && held.client_id === (input.clientId ?? null)) {
        return { ok: true, startISO, label: speakTime(fmtLabel.format(new Date(startMs))), eventId: held.id as string, title };
      }
      return { ok: false, reason: "That time was just taken." };
    }
    return { ok: false, reason: "I couldn't save that booking — let's try another time." };
  }

  // Owner's real calendar (no-op if not connected) — only after the slot is ours.
  await upsertGoogleEvent({ orgId, title, startAt: startISO, endAt: endISO, timezone });

  return { ok: true, startISO, label: speakTime(fmtLabel.format(new Date(startMs))), eventId: evt?.id, title };
}

/** Match a caller to a client by phone, creating a lightweight one if new. */
export async function matchOrCreateClient(orgId: string, phone: string, name?: string | null): Promise<string | null> {
  const db = createServiceClient();
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return existing.id;

  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const { data: created } = await db
    .from("clients")
    .insert({
      organization_id: orgId,
      first_name: parts[0] || "Caller",
      last_name: parts.slice(1).join(" ") || null,
      phone,
      status: "lead",
      source: "voice",
    })
    .select("id")
    .single();
  return created?.id ?? null;
}
