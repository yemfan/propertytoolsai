"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProjectStatus = "active" | "paused" | "completed" | "cancelled";
export type ProjectColor  = "indigo" | "emerald" | "rose" | "amber" | "violet" | "slate";

export type Project = {
  id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: ProjectColor;
  budget_hours: number | null;
  budget_amount: number | null;
  hourly_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  // Joined
  clients?: { first_name: string | null; last_name: string | null; company: string | null } | null;
};

async function getOrgId(): Promise<string> {
  const cookieStore = await cookies();
  const id = cookieStore.get("smbai-org-id")?.value;
  if (!id) throw new Error("No org");
  return id;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listProjects(status?: ProjectStatus): Promise<Project[]> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  let q = supabase
    .from("projects")
    .select("id, client_id, name, description, status, color, budget_hours, budget_amount, hourly_rate, start_date, end_date, created_at, clients(first_name, last_name, company)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...row,
    clients: (Array.isArray(row.clients) ? row.clients[0] : row.clients) ?? null,
  })) as Project[];
}

// ─── Get single project + stats ───────────────────────────────────────────────

export async function getProject(projectId: string): Promise<{
  project: Project;
  stats: {
    totalMinutes: number;
    billableMinutes: number;
    billableAmount: number;
    invoicedAmount: number;
    openTasks: number;
    completedTasks: number;
  };
} | null> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const [{ data: project }, { data: entries }, { data: tasks }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, client_id, name, description, status, color, budget_hours, budget_amount, hourly_rate, start_date, end_date, created_at, clients(first_name, last_name, company)")
      .eq("id", projectId)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("time_entries")
      .select("duration_minutes, billable, hourly_rate, invoiced, ended_at")
      .eq("organization_id", orgId)
      .eq("project_id", projectId)
      .not("ended_at", "is", null),
    supabase
      .from("tasks")
      .select("id, completed")
      .eq("organization_id", orgId)
      .eq("project_id", projectId),
  ]);

  if (!project) return null;

  let totalMinutes = 0, billableMinutes = 0, billableAmount = 0, invoicedAmount = 0;
  for (const e of entries ?? []) {
    const mins = e.duration_minutes ?? 0;
    totalMinutes += mins;
    if (e.billable) {
      billableMinutes += mins;
      const amt = (mins / 60) * Number(e.hourly_rate ?? 0);
      billableAmount += amt;
      if (e.invoiced) invoicedAmount += amt;
    }
  }

  const openTasks      = (tasks ?? []).filter((t) => !t.completed).length;
  const completedTasks = (tasks ?? []).filter((t) => t.completed).length;

  return {
    project: {
      ...project,
      clients: (Array.isArray(project.clients) ? project.clients[0] : project.clients) ?? null,
    } as Project,
    stats: { totalMinutes, billableMinutes, billableAmount, invoicedAmount, openTasks, completedTasks },
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProject(data: {
  name: string;
  description?: string | null;
  clientId?: string | null;
  color?: ProjectColor;
  budgetHours?: number | null;
  budgetAmount?: number | null;
  hourlyRate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<string> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data: proj, error } = await supabase
    .from("projects")
    .insert({
      organization_id: orgId,
      name: data.name,
      description: data.description ?? null,
      client_id: data.clientId ?? null,
      color: data.color ?? "indigo",
      budget_hours: data.budgetHours ?? null,
      budget_amount: data.budgetAmount ?? null,
      hourly_rate: data.hourlyRate ?? null,
      start_date: data.startDate ?? null,
      end_date: data.endDate ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  return proj.id;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProject(
  projectId: string,
  data: Partial<{
    name: string;
    description: string | null;
    clientId: string | null;
    status: ProjectStatus;
    color: ProjectColor;
    budgetHours: number | null;
    budgetAmount: number | null;
    hourlyRate: number | null;
    startDate: string | null;
    endDate: string | null;
  }>
): Promise<void> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name        !== undefined) patch.name         = data.name;
  if (data.description !== undefined) patch.description  = data.description;
  if (data.clientId    !== undefined) patch.client_id    = data.clientId;
  if (data.status      !== undefined) patch.status       = data.status;
  if (data.color       !== undefined) patch.color        = data.color;
  if (data.budgetHours !== undefined) patch.budget_hours = data.budgetHours;
  if (data.budgetAmount!== undefined) patch.budget_amount= data.budgetAmount;
  if (data.hourlyRate  !== undefined) patch.hourly_rate  = data.hourlyRate;
  if (data.startDate   !== undefined) patch.start_date   = data.startDate;
  if (data.endDate     !== undefined) patch.end_date     = data.endDate;

  await supabase.from("projects").update(patch).eq("id", projectId).eq("organization_id", orgId);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteProject(projectId: string): Promise<void> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  await supabase.from("projects").delete().eq("id", projectId).eq("organization_id", orgId);
  revalidatePath("/projects");
}
