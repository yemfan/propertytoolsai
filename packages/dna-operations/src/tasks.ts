import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";

type Db = SupabaseClient<Database>;

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface CreateTaskInput {
  title: string;
  notes?: string;
  due_date?: string;
  client_id?: string;
  priority?: TaskPriority;
}

/** Create a task. Org-scoped; caller revalidates. */
export async function insertTask(db: Db, orgId: string, input: CreateTaskInput): Promise<void> {
  const { error } = await db.from("tasks").insert({
    organization_id: orgId,
    title: input.title,
    notes: input.notes ?? null,
    due_date: input.due_date ?? null,
    client_id: input.client_id || null,
    priority: input.priority ?? "normal",
    status: "open",
  });
  if (error) throw new Error(error.message);
}

/** Update a task's status. Returns the task's client_id so the caller can revalidate it. */
export async function setTaskStatus(
  db: Db,
  orgId: string,
  taskId: string,
  status: TaskStatus
): Promise<{ clientId: string | null }> {
  const { data: task } = await db
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .select("client_id")
    .single();
  return { clientId: task?.client_id ?? null };
}

/** Delete a task. Returns the task's client_id so the caller can revalidate it. */
export async function deleteTask(
  db: Db,
  orgId: string,
  taskId: string
): Promise<{ clientId: string | null }> {
  const { data: task } = await db
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .select("client_id")
    .single();
  return { clientId: task?.client_id ?? null };
}
