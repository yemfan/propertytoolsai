"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NotificationType =
  | "invoice_paid"
  | "invoice_overdue"
  | "new_message"
  | "missed_call"
  | "booking"
  | "system";

// ─── Create (called from server actions / webhooks) ───────────────────────────

/** Creates a notification using the service role — safe to call from webhooks. */
export async function createNotificationService(orgId: string, data: {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  const supabase = createServiceClient();
  await supabase.from("notifications").insert({
    organization_id: orgId,
    type: data.type,
    title: data.title,
    body: data.body ?? null,
    link: data.link ?? null,
  });
}

/** Creates a notification using the session-auth client — safe to call from server actions. */
export async function createNotification(data: {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return;
  await createNotificationService(orgId, data);
}

// ─── Mark read ────────────────────────────────────────────────────────────────

export async function markNotificationsRead(ids?: string[]) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return;

  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .update({ read: true })
    .eq("organization_id", orgId);

  if (ids?.length) {
    query = query.in("id", ids);
  } else {
    query = query.eq("read", false);
  }

  await query;
  revalidatePath("/", "layout");
}

// ─── Get unread count (for layout) ───────────────────────────────────────────

export async function getUnreadCount(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("read", false);
  return count ?? 0;
}

// ─── Get recent notifications ─────────────────────────────────────────────────

export async function getRecentNotifications(orgId: string, limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
