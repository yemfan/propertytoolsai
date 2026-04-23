import "server-only";
import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPlaybook, type PlaybookAnchor } from "./definitions";
import type { PlaybookTaskRow } from "./types";

/**
 * Playbook tasks — per-agent instances created when they apply a
 * curated checklist to an anchor (transaction / open house / contact
 * / bare date).
 *
 * The templates themselves live in TypeScript (see definitions.ts) —
 * we only persist the resulting instances here.
 */

export type ApplyPlaybookInput = {
  agentId: string;
  templateKey: string;
  anchorKind: PlaybookAnchor;
  anchorId: string | null;
  anchorDate: string; // YYYY-MM-DD — used to compute absolute due dates
};

export async function applyPlaybook(input: ApplyPlaybookInput): Promise<{
  batchId: string;
  created: PlaybookTaskRow[];
}> {
  const playbook = getPlaybook(input.templateKey);
  if (!playbook) throw new Error(`Unknown playbook: ${input.templateKey}`);
  if (!playbook.validAnchors.includes(input.anchorKind)) {
    throw new Error(
      `Playbook "${input.templateKey}" doesn't accept anchor kind "${input.anchorKind}"`,
    );
  }
  const anchor = parseYmd(input.anchorDate);
  if (!anchor) throw new Error("Invalid anchorDate (expected YYYY-MM-DD)");

  const batchId = randomUUID();
  const rows = playbook.items.map((item) => ({
    agent_id: input.agentId,
    anchor_kind: input.anchorKind,
    anchor_id: input.anchorId,
    template_key: input.templateKey,
    apply_batch_id: batchId,
    title: item.title,
    notes: item.notes ?? null,
    section: item.section ?? null,
    offset_days: item.offsetDays,
    due_date: toYmd(addDays(anchor, item.offsetDays)),
  }));

  const { data, error } = await supabaseAdmin
    .from("playbook_task_instances")
    .insert(rows)
    .select("*");
  if (error) throw new Error(error.message);

  return {
    batchId,
    created: (data ?? []) as PlaybookTaskRow[],
  };
}

export async function listTasksForAnchor(
  agentId: string,
  anchorKind: PlaybookAnchor,
  anchorId: string | null,
): Promise<PlaybookTaskRow[]> {
  let q = supabaseAdmin
    .from("playbook_task_instances")
    .select("*")
    .eq("agent_id", agentId)
    .eq("anchor_kind", anchorKind)
    .order("due_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  q = anchorId ? q.eq("anchor_id", anchorId) : q.is("anchor_id", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PlaybookTaskRow[];
}

/**
 * Cross-anchor: every task for the agent, regardless of what it's
 * anchored to. Used by the standalone /dashboard/playbooks page.
 * Limit is generous but finite — a newly-onboarded agent shouldn't
 * DoS themselves by applying 50 playbooks.
 */
export async function listAllTasksForAgent(
  agentId: string,
  opts?: { includeCompleted?: boolean },
): Promise<PlaybookTaskRow[]> {
  let q = supabaseAdmin
    .from("playbook_task_instances")
    .select("*")
    .eq("agent_id", agentId)
    .order("due_date", { ascending: true, nullsFirst: true })
    .limit(500);
  if (!opts?.includeCompleted) {
    q = q.is("completed_at", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PlaybookTaskRow[];
}

export async function toggleTask(
  agentId: string,
  taskId: string,
  completed: boolean,
): Promise<PlaybookTaskRow | null> {
  const { data, error } = await supabaseAdmin
    .from("playbook_task_instances")
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("agent_id", agentId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PlaybookTaskRow | null) ?? null;
}

export async function deleteTask(agentId: string, taskId: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from("playbook_task_instances")
    .delete({ count: "exact" })
    .eq("id", taskId)
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function deleteBatch(agentId: string, batchId: string): Promise<number> {
  const { error, count } = await supabaseAdmin
    .from("playbook_task_instances")
    .delete({ count: "exact" })
    .eq("agent_id", agentId)
    .eq("apply_batch_id", batchId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ── Date helpers ───────────────────────────────────────────────────────

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const out = new Date(y, mo - 1, d);
  if (
    out.getFullYear() !== y ||
    out.getMonth() !== mo - 1 ||
    out.getDate() !== d
  ) {
    return null;
  }
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
