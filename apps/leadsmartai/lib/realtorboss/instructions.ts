import "server-only";

import { getAnthropicClient } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAssistantActivity } from "@/lib/realtorboss/activities";

/**
 * Boss Assistant instruction channel.
 *
 * The Realtor writes free-form instructions on the Boss dashboard.
 * Every 5 minutes the cron picks up pending rows and the Boss
 * Assistant turns each into a discrete task list, routing every task
 * to the AI assistant whose job it actually is — or, when no
 * assistant can do it (in-person work, negotiation, judgment calls),
 * leaves it for the Realtor to review (and mirrors it into their real
 * crm_tasks list).
 *
 * Routing is bookkeeping + visibility, not autonomous execution —
 * assigned tasks land in the owning assistant's activity feed so the
 * Boss dashboard shows who has the ball. (Architecture freeze: no
 * workforce engine.)
 */

const MODEL = "claude-sonnet-4-6";

export type ParsedTask = {
  title: string;
  details: string | null;
  assignee:
    | "receptionist"
    | "sales_assistant"
    | "marketing_assistant"
    | "transaction_assistant"
    | "accountant"
    | "realtor";
  /** Person/company the task is about (verbatim from the instruction)
   *  — lets execution match a CRM contact or invoice. */
  contact_name: string | null;
  /** Preferred channel when the task is a message ("sms" | "email"). */
  channel: "sms" | "email" | null;
};

const ASSISTANT_LABELS: Record<ParsedTask["assignee"], string> = {
  receptionist: "AI Receptionist",
  sales_assistant: "AI Sales Assistant",
  marketing_assistant: "AI Marketing Assistant",
  transaction_assistant: "AI Transaction Assistant",
  accountant: "AI Accountant",
  realtor: "you",
};

const SYSTEM_PROMPT = `You are the Boss Assistant, the AI Chief of Staff for a real estate professional. The Realtor has written you free-form instructions. Break them into discrete, actionable tasks and route each task to the team member who can actually do it.

Your AI team and what each member can ACTUALLY do today:
- receptionist: answer inbound calls, send missed-call text-backs, place automatic call-backs, book appointments, take messages.
- sales_assistant: text or call leads, follow up with leads, reactivate quiet leads, qualify buyers/sellers, draft messages for approval.
- marketing_assistant: create and schedule social posts, run multi-step SMS/email marketing plans, manage message templates, nurture the sphere with drips and digests, run lead-generation campaigns.
- transaction_assistant: track transaction deadlines (inspection, appraisal, loan, closing), document reminders, risk alerts on active deals.
- accountant: track the commission pipeline, categorize expenses, track invoices/receivables, recommend payment follow-ups.

Routing rules:
- Assign to an AI assistant ONLY when the task clearly falls inside its capability list above.
- Anything requiring in-person presence, negotiation, signing, legal/contractual judgment, personal relationships, or anything ambiguous → assignee "realtor".
- Split compound instructions into separate tasks. Keep titles short and imperative ("Text Jane Chen about Saturday's showing"). Put specifics (names, addresses, times, amounts) in details.
- Never invent specifics the Realtor didn't give you.
- 1 to 8 tasks. If the instruction is not actionable at all (a greeting, a question, venting), return one task assigned to "realtor" titled "Review note" with the content as details.

Output ONLY a JSON object, no commentary, no markdown fences:
{ "tasks": [ {
  "title": "string",
  "details": "string or null",
  "assignee": "receptionist|sales_assistant|marketing_assistant|transaction_assistant|accountant|realtor",
  "contact_name": "the person or company this task is about, verbatim from the instruction, or null",
  "channel": "sms or email when the task is sending a message (sms when they said text/SMS, email when they said email; default sms for lead messages, email for invoices), else null"
} ] }`;

export async function parseInstruction(content: string): Promise<ParsedTask[]> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `The Realtor's instructions:\n\n${content.slice(0, 4000)}` }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Parser returned no text");

  const body = textBlock.text.trim().replace(/```(?:json)?|```/g, "");
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Parser returned non-JSON");
  const raw = JSON.parse(body.slice(first, last + 1)) as { tasks?: unknown };

  const VALID = new Set([
    "receptionist",
    "sales_assistant",
    "marketing_assistant",
    "transaction_assistant",
    "accountant",
    "realtor",
  ]);
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .map((t) => {
      const r = t as {
        title?: unknown;
        details?: unknown;
        assignee?: unknown;
        contact_name?: unknown;
        channel?: unknown;
      };
      const title = typeof r.title === "string" ? r.title.trim().slice(0, 200) : "";
      const assignee = VALID.has(String(r.assignee)) ? (r.assignee as ParsedTask["assignee"]) : "realtor";
      const details = typeof r.details === "string" && r.details.trim() ? r.details.trim().slice(0, 1000) : null;
      const contactName =
        typeof r.contact_name === "string" && r.contact_name.trim() ? r.contact_name.trim().slice(0, 120) : null;
      const channel = r.channel === "sms" || r.channel === "email" ? r.channel : null;
      return title ? { title, details, assignee, contact_name: contactName, channel } : null;
    })
    .filter((t): t is ParsedTask => t !== null)
    .slice(0, 8);
  if (tasks.length === 0) throw new Error("Parser returned no tasks");
  return tasks;
}

type InstructionRow = {
  id: string;
  agent_id: unknown;
  content: string;
};

/** Process up to `limit` pending instructions. Called by the
 *  every-5-minutes cron (/api/cron/boss-instructions). */
export async function processPendingInstructions(limit = 10): Promise<{
  processed: number;
  tasksCreated: number;
  failed: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("boss_instructions")
    .select("id, agent_id, content")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[boss-instructions] pending query failed:", error.message);
    return { processed: 0, tasksCreated: 0, failed: 1 };
  }

  const rows = (data ?? []) as InstructionRow[];
  let processed = 0;
  let tasksCreated = 0;
  let failed = 0;

  for (const row of rows) {
    const agentId = String(row.agent_id);
    // Claim — a parallel cron invocation skips rows already processing.
    const { data: claimed } = await supabaseAdmin
      .from("boss_instructions")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    try {
      const tasks = await parseInstruction(row.content);

      const assignedToAi: ParsedTask[] = [];
      const forRealtor: ParsedTask[] = [];
      for (const t of tasks) {
        let crmTaskId: string | null = null;
        if (t.assignee === "realtor") {
          // Mirror into the Realtor's real task list for review.
          const { data: crmTask } = await supabaseAdmin
            .from("crm_tasks")
            .insert({
              agent_id: agentId,
              title: t.title,
              description: t.details
                ? `${t.details}\n\n(From your instructions to the Boss Assistant.)`
                : "From your instructions to the Boss Assistant.",
              status: "open",
              priority: "high",
              source: "automation",
              task_type: "boss_instruction",
              metadata_json: { boss_instruction_id: row.id },
            })
            .select("id")
            .maybeSingle();
          crmTaskId = (crmTask as { id: string } | null)?.id ?? null;
          forRealtor.push(t);
        } else {
          assignedToAi.push(t);
        }

        const { data: insertedTask } = await supabaseAdmin
          .from("boss_instruction_tasks")
          .insert({
            instruction_id: row.id,
            agent_id: agentId,
            title: t.title,
            details: t.details,
            assigned_to: t.assignee,
            status: t.assignee === "realtor" ? "needs_review" : "assigned",
            crm_task_id: crmTaskId,
          })
          .select("id")
          .maybeSingle();
        tasksCreated += 1;

        // EXECUTION (architecture unfrozen): messaging tasks get the
        // real draft prepared now — the Realtor approves on the Boss
        // card and it sends. Falls back to plain "assigned" when we
        // can't execute confidently.
        const taskId = (insertedTask as { id: string } | null)?.id;
        let executed: "awaiting_approval" | "assigned" = "assigned";
        if (taskId && t.assignee !== "realtor") {
          const { tryExecuteTask } = await import("@/lib/realtorboss/execution");
          executed = await tryExecuteTask({ agentId, taskId, task: t });
        }

        // Visibility: the owning assistant's feed shows what the Boss
        // put on its desk — and whether a draft is waiting for you.
        if (t.assignee !== "realtor") {
          void logAssistantActivity({
            agentId,
            assistantType: t.assignee,
            activityType: executed === "awaiting_approval" ? "boss_task_drafted" : "boss_task_assigned",
            summary:
              executed === "awaiting_approval"
                ? `Drafted for your approval: ${t.title}`
                : `Boss Assistant assigned: ${t.title}`,
            outcome: t.details,
            requiresAttention: executed === "awaiting_approval",
          });
        }
      }

      await supabaseAdmin
        .from("boss_instructions")
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      processed += 1;

      void logAssistantActivity({
        agentId,
        assistantType: "boss_assistant",
        activityType: "instructions_processed",
        summary: `Turned your instructions into ${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
        outcome: [
          assignedToAi.length > 0
            ? `${assignedToAi.length} assigned to the team (${[...new Set(assignedToAi.map((t) => ASSISTANT_LABELS[t.assignee]))].join(", ")})`
            : null,
          forRealtor.length > 0 ? `${forRealtor.length} for your review` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        requiresAttention: forRealtor.length > 0,
      });
    } catch (e) {
      failed += 1;
      console.error(`[boss-instructions] processing ${row.id} failed:`, e);
      await supabaseAdmin
        .from("boss_instructions")
        .update({
          status: "failed",
          error: (e instanceof Error ? e.message : "Processing failed").slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return { processed, tasksCreated, failed };
}
