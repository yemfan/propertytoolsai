import { listMobileCalendarEvents } from "@/lib/mobile/calendarMobile";
import { listMobileTasksGrouped } from "@/lib/mobile/leadTasksMobile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MobileFollowUpReminderDto, MobileRemindersResponseDto } from "@leadsmart/shared";

export async function getMobileReminders(agentId: string): Promise<MobileRemindersResponseDto> {
  const now = Date.now();

  const [appointments, grouped, followRows] = await Promise.all([
    listMobileCalendarEvents({
      agentId,
      fromIso: new Date().toISOString(),
      toIso: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    listMobileTasksGrouped(agentId),
    supabaseAdmin
      .from("leads")
      .select("id,name,next_contact_at")
      .eq("agent_id", agentId as never)
      .is("merged_into_lead_id", null)
      .not("next_contact_at", "is", null)
      .order("next_contact_at", { ascending: true })
      .limit(120),
  ]);

  if (followRows.error) throw new Error(followRows.error.message);

  const follow_ups: MobileFollowUpReminderDto[] = (followRows.data ?? []).map((row) => {
    const r = row as { id: unknown; name: unknown; next_contact_at: unknown };
    const at = String(r.next_contact_at ?? "");
    return {
      lead_id: String(r.id ?? ""),
      lead_name: r.name != null ? String(r.name) : null,
      next_contact_at: at,
      overdue: new Date(at).getTime() < now,
    };
  });

  return {
    upcoming_appointments: appointments,
    overdue_tasks: grouped.overdue,
    follow_ups,
  };
}
