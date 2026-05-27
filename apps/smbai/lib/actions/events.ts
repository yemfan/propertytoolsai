"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createEvent(data: {
  title: string;
  description?: string;
  location?: string;
  type: "appointment" | "task" | "meeting" | "reminder";
  color: "indigo" | "emerald" | "rose" | "amber" | "slate";
  startAt: string;   // ISO string
  endAt?: string;
  allDay: boolean;
  clientId?: string | null;
}) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    organization_id: orgId,
    client_id: data.clientId ?? null,
    title: data.title,
    description: data.description ?? null,
    location: data.location ?? null,
    type: data.type,
    color: data.color,
    start_at: data.startAt,
    end_at: data.endAt ?? null,
    all_day: data.allDay,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
}

export async function updateEvent(
  eventId: string,
  data: Partial<{
    title: string;
    description: string;
    location: string;
    type: string;
    color: string;
    start_at: string;
    end_at: string;
    all_day: boolean;
    completed: boolean;
    client_id: string | null;
  }>
) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("organization_id", orgId);

  revalidatePath("/calendar");
}

export async function deleteEvent(eventId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("organization_id", orgId);

  revalidatePath("/calendar");
}

export async function toggleEventComplete(eventId: string, completed: boolean) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("organization_id", orgId);

  revalidatePath("/calendar");
}
