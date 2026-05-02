import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPlaybook } from "@/lib/playbooks/definitions";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/tasks/unified
 *
 * Phase-1 read-merge: returns the agent's tasks from BOTH backends —
 *   - public.crm_tasks (manual + briefing-generated tasks)
 *   - public.playbook_task_instances (per-anchor playbook batches,
 *     including coaching-program tasks identified by template_key)
 *
 * Items are normalized into a single shape with a stable `source`
 * discriminator the UI uses for filter chips + row annotations. IDs
 * are namespaced ("crm:<uuid>" / "pb:<uuid>") so write-paths can route
 * back to the right backend in Phase 2.
 *
 * Query:
 *   - status=open|done|cancelled|all   (default: open)
 *
 * Phase 2c: source detection moved off the title-prefix regex onto the
 * real `crm_tasks.source` column, and coaching detection moved off the
 * `template_key` startsWith hack onto `playbook_task_instances.program_slug`.
 * Briefing tasks now actually surface here because the briefing writer
 * also moved to crm_tasks (was writing to the deprecated public.tasks).
 */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getCurrentAgentContext();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "open";
  const status = (
    statusParam === "all" || statusParam === "open" || statusParam === "done" || statusParam === "cancelled"
      ? statusParam
      : "open"
  ) as "all" | "open" | "done" | "cancelled";

  const [crmRows, pbRows, contactNameMap] = await Promise.all([
    fetchCrmTasks(String(ctx.agentId), status),
    fetchPlaybookTasks(String(ctx.agentId), status),
    fetchContactNameMap(String(ctx.agentId)),
  ]);

  const unified: UnifiedTaskDto[] = [
    ...crmRows.map((row) => normalizeCrmTask(row, contactNameMap)),
    ...pbRows.map((row) => normalizePlaybookTask(row, contactNameMap)),
  ];

  // Sort by due date ascending — overdue first, then today, then
  // upcoming, then undated. nullsLast for due-less rows.
  unified.sort(byDueDateAsc);

  return NextResponse.json({ ok: true, tasks: unified });
}

// ── Types ────────────────────────────────────────────────────────────

type UnifiedSource = "manual" | "briefing" | "playbook" | "coaching";

type UnifiedTaskDto = {
  /** Namespaced id: "crm:<uuid>" or "pb:<uuid>". */
  id: string;
  source: UnifiedSource;
  title: string;
  description: string | null;
  status: "open" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent" | null;
  /** Always ISO; playbook rows synthesize end-of-local-day from due_date. */
  due_at: string | null;
  completed_at: string | null;
  contact_id: string | null;
  contact_name: string | null;
  /** Populated only for source="playbook" or "coaching". */
  playbook?: {
    templateKey: string;
    title: string;
    section: string | null;
    batchId: string | null;
    anchorKind: "transaction" | "open_house" | "contact" | "generic";
    anchorId: string | null;
  };
};

// ── Fetchers ─────────────────────────────────────────────────────────

type CrmTaskRowSlim = {
  id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  due_at: string | null;
  completed_at: string | null;
  source: string | null;
};

async function fetchCrmTasks(
  agentId: string,
  status: "all" | "open" | "done" | "cancelled",
): Promise<CrmTaskRowSlim[]> {
  let q = supabaseAdmin
    .from("crm_tasks")
    .select("id,contact_id,title,description,status,priority,due_at,completed_at,source")
    .eq("agent_id", agentId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(250);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    console.error("[tasks/unified] crm_tasks fetch", error);
    return [];
  }
  return (data ?? []) as CrmTaskRowSlim[];
}

type PlaybookRowSlim = {
  id: string;
  template_key: string;
  apply_batch_id: string | null;
  anchor_kind: string;
  anchor_id: string | null;
  title: string;
  notes: string | null;
  section: string | null;
  due_date: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  program_slug: string | null;
};

async function fetchPlaybookTasks(
  agentId: string,
  status: "all" | "open" | "done" | "cancelled",
): Promise<PlaybookRowSlim[]> {
  let q = supabaseAdmin
    .from("playbook_task_instances")
    .select("id,template_key,apply_batch_id,anchor_kind,anchor_id,title,notes,section,due_date,completed_at,cancelled_at,program_slug")
    .eq("agent_id", agentId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(250);
  if (status === "open") {
    q = q.is("completed_at", null).is("cancelled_at", null);
  } else if (status === "done") {
    q = q.not("completed_at", "is", null);
  } else if (status === "cancelled") {
    q = q.not("cancelled_at", "is", null);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[tasks/unified] playbook fetch", error);
    return [];
  }
  return (data ?? []) as PlaybookRowSlim[];
}

/**
 * Resolve contact_id → display name for both CRM tasks (direct FK)
 * and playbook tasks anchored to a contact. Single round-trip; we
 * fetch all contacts for this agent once and look up locally.
 */
async function fetchContactNameMap(agentId: string): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id,name,first_name,last_name,email")
    .eq("agent_id", agentId)
    .limit(1000);
  const out = new Map<string, string>();
  for (const row of (data ?? []) as Array<{
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>) {
    const display =
      row.name?.trim() ||
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
      row.email?.trim() ||
      "";
    if (display) out.set(String(row.id), display);
  }
  return out;
}

// ── Normalizers ──────────────────────────────────────────────────────

function normalizeCrmTask(
  row: CrmTaskRowSlim,
  contacts: Map<string, string>,
): UnifiedTaskDto {
  // Phase 2c: source comes from the column. Older rows that predate
  // the column default to 'manual' via the schema default; map any
  // unrecognized value to 'manual' so the chip filter stays sane.
  const src = normalizeCrmSource(row.source);
  return {
    id: `crm:${row.id}`,
    source: src,
    title: row.title,
    description: row.description ?? null,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    due_at: row.due_at,
    completed_at: row.completed_at,
    contact_id: row.contact_id,
    contact_name: row.contact_id ? contacts.get(row.contact_id) ?? null : null,
  };
}

function normalizePlaybookTask(
  row: PlaybookRowSlim,
  contacts: Map<string, string>,
): UnifiedTaskDto {
  const playbook = getPlaybook(row.template_key);
  // Phase 2c: coaching is a column now; non-coaching rows have NULL.
  const isCoaching = row.program_slug != null;
  const dueAtIso = row.due_date ? `${row.due_date}T17:00:00Z` : null; // synthesize end-of-day
  // Anchor → contact name resolution: only for anchor_kind=contact.
  const anchoredContactName =
    row.anchor_kind === "contact" && row.anchor_id
      ? contacts.get(row.anchor_id) ?? null
      : null;
  return {
    id: `pb:${row.id}`,
    source: isCoaching ? "coaching" : "playbook",
    title: row.title,
    description: row.notes ?? null,
    status: row.cancelled_at ? "cancelled" : row.completed_at ? "done" : "open",
    priority: null,
    due_at: dueAtIso,
    completed_at: row.completed_at,
    contact_id: row.anchor_kind === "contact" ? row.anchor_id : null,
    contact_name: anchoredContactName,
    playbook: {
      templateKey: row.template_key,
      title: playbook?.title ?? row.template_key,
      section: row.section,
      batchId: row.apply_batch_id,
      anchorKind: row.anchor_kind as "transaction" | "open_house" | "contact" | "generic",
      anchorId: row.anchor_id,
    },
  };
}

function normalizeStatus(s: string): "open" | "done" | "cancelled" {
  if (s === "done" || s === "cancelled") return s;
  return "open";
}

/**
 * crm_tasks.source check accepts manual, briefing, ai_call, automation,
 * playbook, legacy. The unified-view chip palette is a smaller set —
 * collapse ai_call/automation/legacy into "manual" for now (they all
 * read as "the agent didn't make this themselves but it's not a
 * playbook either"). Future iteration can split the chips out.
 */
function normalizeCrmSource(
  s: string | null,
): "manual" | "briefing" | "playbook" | "coaching" {
  if (s === "briefing") return "briefing";
  if (s === "playbook") return "playbook";
  return "manual";
}

function normalizePriority(p: string | null): "low" | "normal" | "high" | "urgent" | null {
  if (p === "low" || p === "normal" || p === "high" || p === "urgent") return p;
  return null;
}

function byDueDateAsc(a: UnifiedTaskDto, b: UnifiedTaskDto): number {
  if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
  if (a.due_at) return -1;
  if (b.due_at) return 1;
  return 0;
}
