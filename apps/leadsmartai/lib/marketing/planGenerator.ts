import { supabaseAdmin } from "@/lib/supabase/admin";
import { createTask } from "@/lib/crm/pipeline/tasks";
import { getTemplate } from "./templates";
import type { PlanWithSteps, TemplateKey, TriggerType } from "./types";

/**
 * Generate a marketing plan from a template for a specific lead.
 * Replaces {{name}} and {{address}} placeholders with lead data.
 * Returns the plan in "draft" status — agent must approve before execution.
 */
export async function generatePlan(params: {
  agentId: string;
  leadId: string;
  templateKey: TemplateKey;
  triggerType?: TriggerType;
}): Promise<PlanWithSteps> {
  const template = getTemplate(params.templateKey);
  if (!template) throw new Error(`Unknown template: ${params.templateKey}`);

  // Fetch lead data for placeholder replacement.
  const { data: lead } = await supabaseAdmin
    .from("contacts")
    .select("name, email, phone, property_address")
    .eq("id", params.leadId)
    .maybeSingle();

  const name = String((lead as Record<string, unknown>)?.name ?? "there");
  const address = String((lead as Record<string, unknown>)?.property_address ?? "your property");

  function fillPlaceholders(text: string): string {
    return text.replace(/\{\{name\}\}/g, name).replace(/\{\{address\}\}/g, address);
  }

  // Insert plan.
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("marketing_plans")
    .insert({
      agent_id: params.agentId as unknown as number,
      contact_id: params.leadId as unknown as number,
      template_key: params.templateKey,
      title: fillPlaceholders(template.title),
      status: "draft",
      trigger_type: params.triggerType ?? template.trigger_type,
      metadata_json: { template_key: params.templateKey, lead_name: name },
    } as Record<string, unknown>)
    .select("*")
    .single();

  if (planErr || !plan) throw new Error(planErr?.message ?? "Failed to create plan");

  const planId = String((plan as Record<string, unknown>).id);

  // Insert steps.
  const stepInserts = template.steps.map((s, i) => ({
    plan_id: planId,
    step_order: i + 1,
    channel: s.channel,
    action: s.action,
    subject: s.subject ? fillPlaceholders(s.subject) : null,
    body: fillPlaceholders(s.body),
    delay_days: s.delay_days,
    enabled: true,
    status: "pending",
  }));

  const { data: steps, error: stepsErr } = await supabaseAdmin
    .from("marketing_plan_steps")
    .insert(stepInserts as Record<string, unknown>[])
    .select("*");

  if (stepsErr) throw new Error(stepsErr.message);

  return {
    ...(plan as unknown as PlanWithSteps),
    steps: (steps ?? []) as unknown as PlanWithSteps["steps"],
  };
}

/**
 * Approve a plan — sets status to "approved", records timestamp,
 * and creates CRM tasks from enabled "create_task" steps.
 */
export async function approvePlan(planId: string): Promise<void> {
  // Update plan status.
  const { error } = await supabaseAdmin
    .from("marketing_plans")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  // Fetch plan + steps to create CRM tasks.
  try {
    const { data: plan } = await supabaseAdmin
      .from("marketing_plans")
      .select("agent_id, contact_id, title")
      .eq("id", planId)
      .maybeSingle();

    if (!plan) return;

    const agentId = String((plan as Record<string, unknown>).agent_id);
    const leadId = (plan as Record<string, unknown>).contact_id ? String((plan as Record<string, unknown>).contact_id) : null;

    const { data: steps } = await supabaseAdmin
      .from("marketing_plan_steps")
      .select("action, body, delay_days, enabled")
      .eq("plan_id", planId)
      .eq("enabled", true)
      .order("step_order", { ascending: true });

    if (!steps?.length) return;

    for (const step of steps as Array<Record<string, unknown>>) {
      const dueAt = new Date(Date.now() + Number(step.delay_days ?? 0) * 86_400_000).toISOString();

      await createTask({
        agentId,
        leadId,
        title: String(step.body ?? "").slice(0, 200),
        description: `From marketing plan: ${(plan as Record<string, unknown>).title ?? planId}`,
        priority: "normal",
        dueAt,
        source: "automation",
        aiRationale: "Auto-created when marketing plan was approved",
      });
    }
  } catch (e) {
    console.warn("approvePlan: task creation failed (non-blocking)", e);
  }
}

/**
 * Start an approved plan — sets status to "active".
 */
export async function startPlan(planId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("marketing_plans")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("status", "approved");

  if (error) throw new Error(error.message);
}

/**
 * Pause or cancel a plan.
 */
export async function updatePlanStatus(
  planId: string,
  status: "paused" | "cancelled"
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "cancelled") {
    update.completed_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("marketing_plans")
    .update(update)
    .eq("id", planId);

  if (error) throw new Error(error.message);
}

/**
 * Update a step (toggle enabled, edit body/subject).
 */
export async function updateStep(
  stepId: string,
  patch: { enabled?: boolean; body?: string; subject?: string; delay_days?: number }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("marketing_plan_steps")
    .update(patch as Record<string, unknown>)
    .eq("id", stepId);

  if (error) throw new Error(error.message);
}
