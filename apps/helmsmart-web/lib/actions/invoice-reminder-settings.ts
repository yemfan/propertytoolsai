"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveReminderSettings(input: {
  autoSend: boolean;
  daysIntervals: number[];
  maxCount: number;
}): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const db = await createServiceClient();
  const { error } = await db
    .from("organizations")
    .update({
      auto_send_reminders: input.autoSend,
      reminder_days_intervals: input.daysIntervals,
      reminder_max_count: input.maxCount,
    })
    .eq("id", orgId);

  if (error) {
    console.error("[reminder-settings] update error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
