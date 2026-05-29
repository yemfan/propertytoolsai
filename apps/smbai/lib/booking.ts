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

  const dayHours = hours?.[weekdayKey(dateStr)] ?? null;
  if (!dayHours) return { closed: true, durationMinutes: duration, slots: [] };

  const openUtc = zonedToUtc(dateStr, dayHours.open, timezone);
  const closeUtc = zonedToUtc(dateStr, dayHours.close, timezone);
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
    slots.push({ startISO: new Date(t).toISOString(), label: fmt.format(new Date(t)) });
    if (slots.length >= 5) break;
  }
  return { closed: false, durationMinutes: duration, slots };
}

export type BookResult = { ok: boolean; reason?: string; startISO?: string; label?: string; eventId?: string; title?: string };

/** Book a specific slot — re-validates, writes to Google Calendar (if connected) + the internal calendar. */
export async function bookAppointment(
  orgId: string,
  input: { appointmentTypeName: string; startISO: string; clientId?: string | null; callerName?: string | null }
): Promise<BookResult> {
  const { timezone } = await loadOrg(orgId);
  const type = await findType(orgId, input.appointmentTypeName);
  const duration = type?.duration_minutes ?? 30;

  const startMs = new Date(input.startISO).getTime();
  if (Number.isNaN(startMs) || startMs < Date.now()) {
    return { ok: false, reason: "That time isn't valid or is in the past." };
  }
  const endMs = startMs + duration * 60_000;

  const busy = await busyIntervals(orgId, new Date(startMs - 1), new Date(endMs + 1));
  if (overlapsBusy(startMs, endMs, busy)) return { ok: false, reason: "That time was just taken." };

  const title = `${type?.name ?? "Appointment"}${input.callerName ? ` — ${input.callerName}` : ""}`;
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(endMs).toISOString();

  // Owner's real calendar (no-op if not connected).
  await upsertGoogleEvent({ orgId, title, startAt: startISO, endAt: endISO, timezone });

  // smbai's internal calendar (always — so the booking shows in the app).
  const db = createServiceClient();
  const { data: evt } = await db
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

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return { ok: true, startISO, label: fmt.format(new Date(startMs)), eventId: evt?.id, title };
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
