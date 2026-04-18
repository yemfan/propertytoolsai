import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";
import TasksClient from "./TasksClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Manage your daily tasks and follow-up reminders.",
  keywords: ["tasks", "to-do", "follow-ups"],
  robots: { index: false },
};

export default async function TasksPage() {
  const ctx = await getCurrentAgentContext();

  const [tasksRes, leadsRes] = await Promise.all([
    supabaseServer
      .from("crm_tasks")
      .select("id, title, description, status, priority, due_at, completed_at, source, contact_id, created_at, updated_at")
      .eq("agent_id", ctx.agentId)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabaseServer
      .from("contacts")
      .select("id, name")
      .eq("agent_id", ctx.agentId)
      .limit(500),
  ]);

  return (
    <TasksClient
      tasks={(tasksRes.data ?? []) as any[]}
      leads={(leadsRes.data ?? []).map((l: any) => ({ id: String(l.id), name: l.name }))}
    />
  );
}
