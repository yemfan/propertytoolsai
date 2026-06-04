import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getRescheduleAvailability } from "@/lib/booking";
import { RescheduleSlots } from "./reschedule-slots";

const DEFAULT_TZ = "America/New_York";

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  const { date: dateParam } = await searchParams;
  const sb = await createServiceClient();

  const { data: ev } = await sb
    .from("events")
    .select("id, organization_id, start_at, end_at, title")
    .eq("reschedule_token", token)
    .eq("type", "appointment")
    .maybeSingle();
  if (!ev) notFound();

  const { data: org } = await sb.from("organizations").select("name, timezone").eq("id", ev.organization_id).single();
  const orgName = org?.name ?? "HelmSmart";
  const tz = (org?.timezone as string) || DEFAULT_TZ;

  const startMs = new Date(ev.start_at).getTime();
  const past = startMs < Date.now();
  const durationMin = ev.end_at ? Math.max(15, Math.round((new Date(ev.end_at).getTime() - startMs) / 60000)) : 30;

  const fmtFull = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const currentLabel = fmtFull.format(new Date(ev.start_at));

  // Day chips: today + next 9 days (org-local dates).
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const chipFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  const todayStr = dayFmt.format(new Date());
  const days = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400_000);
    return { value: dayFmt.format(d), label: i === 0 ? "Today" : chipFmt.format(d) };
  });
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;

  const avail = past
    ? { closed: true, durationMinutes: durationMin, slots: [] as { startISO: string; label: string }[] }
    : await getRescheduleAvailability(ev.organization_id, durationMin, selectedDate);
  const slotFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const slots = avail.slots.map((s) => ({ startISO: s.startISO, label: slotFmt.format(new Date(s.startISO)) }));

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background: "#1e88e5", padding: "16px 0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{orgName}</span>
          <span style={{ color: "#aad4f7", fontSize: 13 }}>Reschedule</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Reschedule your appointment</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
          Currently booked for <strong>{currentLabel}</strong>. Pick a new time below.
        </p>

        {past ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px", textAlign: "center", color: "#64748b" }}>
            This appointment has already passed. Text us to book a new one.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
              {days.map((d) => {
                const active = d.value === selectedDate;
                return (
                  <a
                    key={d.value}
                    href={`?date=${d.value}`}
                    style={{
                      flexShrink: 0,
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      border: active ? "1px solid #1e88e5" : "1px solid #e2e8f0",
                      background: active ? "#1e88e5" : "#fff",
                      color: active ? "#fff" : "#475569",
                    }}
                  >
                    {d.label}
                  </a>
                );
              })}
            </div>

            <RescheduleSlots token={token} slots={slots} />
          </>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 40 }}>Powered by HelmSmart · {orgName}</p>
      </div>
    </div>
  );
}
