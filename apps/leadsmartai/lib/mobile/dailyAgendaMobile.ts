import { listMobileCalendarEvents } from "@/lib/mobile/calendarMobile";
import { listMobileTasksGrouped } from "@/lib/mobile/leadTasksMobile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DailyAgendaItem, MobileDailyAgendaResponseDto } from "@leadsmart/shared";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC calendar day bounds; `date` optional `YYYY-MM-DD`. */
function utcDayBounds(dateParam?: string | null): { start: Date; end: Date; agendaDate: string } {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam.trim())) {
    const [y, mo, d] = dateParam.trim().split("-").map(Number);
    const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
    return { start, end, agendaDate: `${y}-${pad2(mo)}-${pad2(d)}` };
  }
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  return { start, end, agendaDate: `${y}-${pad2(m + 1)}-${pad2(d)}` };
}

function agendaPriority(p: string | undefined | null): "low" | "medium" | "high" | undefined {
  const v = String(p || "").toLowerCase();
  if (v === "urgent") return "high";
  if (v === "low" || v === "medium" || v === "high") return v;
  return undefined;
}

export async function getMobileDailyAgenda(
  agentId: string,
  dateParam?: string | null
): Promise<MobileDailyAgendaResponseDto> {
  const { start, end, agendaDate } = utcDayBounds(dateParam);
  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const [grouped, events, followRes] = await Promise.all([
    listMobileTasksGrouped(agentId),
    listMobileCalendarEvents({ agentId, fromIso, toIso }),
    supabaseAdmin
      .from("contacts")
      .select("id,name,next_contact_at")
      .eq("agent_id", agentId as never)
      .is("merged_into_lead_id", null)
      .gte("next_contact_at", fromIso)
      .lte("next_contact_at", toIso)
      .order("next_contact_at", { ascending: true })
      .limit(150),
  ]);

  if (followRes.error) throw new Error(followRes.error.message);

  const items: DailyAgendaItem[] = [];

  for (const t of grouped.today) {
    const dueAt = t.due_at ?? fromIso;
    items.push({
      id: `task:${t.id}`,
      type: "task",
      title: t.title,
      subtitle: t.lead_name ?? undefined,
      dueAt,
      leadId: t.contact_id,
      priority: agendaPriority(t.priority),
      status: t.status,
    });
  }

  for (const ev of events) {
    items.push({
      id: `appointment:${ev.id}`,
      type: "appointment",
      title: ev.title,
      subtitle: ev.lead_name ?? undefined,
      dueAt: ev.starts_at,
      leadId: ev.contact_id,
      priority: "medium",
      status: ev.status,
    });
  }

  for (const row of followRes.data ?? []) {
    const r = row as { id: unknown; name: unknown; next_contact_at: unknown };
    const lid = String(r.id ?? "");
    const at = String(r.next_contact_at ?? "");
    if (!at) continue;
    const name = r.name != null ? String(r.name) : null;
    items.push({
      id: `follow_up:${lid}:${at}`,
      type: "follow_up",
      title: name ? `Follow up · ${name}` : "Follow up",
      subtitle: name ?? undefined,
      dueAt: at,
      leadId: lid,
    });
  }

  items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return { agendaDate, items };
}
