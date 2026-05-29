"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "normal" | "high" | "urgent";

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTask(data: {
  title: string;
  notes?: string;
  due_date?: string;
  client_id?: string;
  priority?: TaskPriority;
}) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    organization_id: orgId,
    title: data.title,
    notes: data.notes ?? null,
    due_date: data.due_date ?? null,
    client_id: data.client_id || null,
    priority: data.priority ?? "normal",
    status: "open",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  if (data.client_id) revalidatePath(`/clients/${data.client_id}`);
}

// ─── Update status ────────────────────────────────────────────────────────────

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .select("client_id")
    .single();

  revalidatePath("/tasks");
  if (task?.client_id) revalidatePath(`/clients/${task.client_id}`);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .select("client_id")
    .single();

  revalidatePath("/tasks");
  if (task?.client_id) revalidatePath(`/clients/${task.client_id}`);
}
