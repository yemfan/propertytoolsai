import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Template,
  TemplateChannel,
  TemplateRow,
  TemplateOverride,
  TemplateOverrideRow,
  TemplateStatus,
  TemplateWithOverride,
} from "./types";

function mapTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    language: row.language,
    variantOf: row.variant_of,
    placeholders: Array.isArray(row.placeholders) ? row.placeholders : [],
    triggerConfig:
      row.trigger_config && typeof row.trigger_config === "object"
        ? (row.trigger_config as Record<string, unknown>)
        : {},
    notes: row.notes,
    defaultStatus: row.default_status,
    source: row.source,
  };
}

function mapOverride(row: TemplateOverrideRow): TemplateOverride {
  return {
    templateId: row.template_id,
    status: row.status,
    subjectOverride: row.subject_override,
    bodyOverride: row.body_override,
    edited: row.edited,
  };
}

function merge(t: Template, ov: TemplateOverride | null): TemplateWithOverride {
  return {
    ...t,
    override: ov,
    effectiveStatus: ov?.status ?? t.defaultStatus,
    effectiveSubject: ov?.subjectOverride ?? t.subject,
    effectiveBody: ov?.bodyOverride ?? t.body,
  };
}

export async function listTemplatesForAgent(agentId: string): Promise<TemplateWithOverride[]> {
  const [{ data: tplRows, error: tplErr }, { data: ovRows }] = await Promise.all([
    supabaseAdmin
      .from("templates")
      .select("*")
      .order("category")
      .order("id"),
    supabaseAdmin
      .from("template_overrides")
      .select("*")
      .eq("agent_id", agentId as never),
  ]);

  if (tplErr) throw tplErr;
  const templates = (tplRows ?? []).map((r) => mapTemplate(r as unknown as TemplateRow));
  const overrides = new Map<string, TemplateOverride>();
  for (const row of ovRows ?? []) {
    const ov = mapOverride(row as unknown as TemplateOverrideRow);
    overrides.set(ov.templateId, ov);
  }
  return templates.map((t) => merge(t, overrides.get(t.id) ?? null));
}

export async function getTemplateForAgent(
  agentId: string,
  templateId: string,
): Promise<TemplateWithOverride | null> {
  const [{ data: tplRow }, { data: ovRow }] = await Promise.all([
    supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle(),
    supabaseAdmin
      .from("template_overrides")
      .select("*")
      .eq("agent_id", agentId as never)
      .eq("template_id", templateId)
      .maybeSingle(),
  ]);
  if (!tplRow) return null;
  const t = mapTemplate(tplRow as unknown as TemplateRow);
  const ov = ovRow ? mapOverride(ovRow as unknown as TemplateOverrideRow) : null;
  return merge(t, ov);
}

export type UpsertTemplateOverrideInput = {
  status?: TemplateStatus;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
};

export async function upsertTemplateOverride(
  agentId: string,
  templateId: string,
  input: UpsertTemplateOverrideInput,
): Promise<TemplateOverride> {
  // Read existing to preserve fields the caller didn't send.
  const { data: existing } = await supabaseAdmin
    .from("template_overrides")
    .select("*")
    .eq("agent_id", agentId as never)
    .eq("template_id", templateId)
    .maybeSingle();
  const current = existing ? mapOverride(existing as unknown as TemplateOverrideRow) : null;

  const next = {
    status: input.status ?? current?.status ?? "review",
    subjectOverride:
      input.subjectOverride !== undefined ? input.subjectOverride : (current?.subjectOverride ?? null),
    bodyOverride:
      input.bodyOverride !== undefined ? input.bodyOverride : (current?.bodyOverride ?? null),
  };
  const edited = next.subjectOverride !== null || next.bodyOverride !== null;

  const { error } = await supabaseAdmin
    .from("template_overrides")
    .upsert(
      {
        agent_id: agentId as never,
        template_id: templateId,
        status: next.status,
        subject_override: next.subjectOverride,
        body_override: next.bodyOverride,
        edited,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "agent_id,template_id" },
    );
  if (error) throw error;
  return { templateId, ...next, edited };
}

export function validateStatus(v: unknown): TemplateStatus | undefined {
  return v === "autosend" || v === "review" || v === "off" ? v : undefined;
}

export function smsLengthForBody(body: string): number {
  // SMS is measured by codepoints; reasonably close for previews. GSM-7 vs UCS-2
  // transitions (emoji, accented chars) are ignored — good enough for a counter.
  return Array.from(body).length;
}

export function channelPreviewMaxChars(channel: TemplateChannel): number | null {
  return channel === "sms" ? 160 : null;
}
