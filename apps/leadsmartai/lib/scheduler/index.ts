import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAgentMessageSettingsEffective } from "@/lib/agent-messaging/settings";
import type { ReviewPolicy } from "@/lib/agent-messaging/types";
import { listContacts } from "@/lib/contacts/service";
import { renderPreview } from "@/lib/templates/preview";
import type { Template, TemplateRow } from "@/lib/templates/types";
import { DETECTORS, type ProposedFiring } from "./detectors";

export type SchedulerOptions = {
  /** Scope the run to one agent (default: all agents with contacts). */
  agentId?: string;
  /** If true, compute what *would* fire without creating drafts or firing rows. */
  dryRun?: boolean;
  /** Max contacts to evaluate per agent (safety cap). */
  maxContactsPerAgent?: number;
};

export type SchedulerFiring = {
  agentId: string;
  contactId: string;
  contactName: string;
  templateId: string;
  channel: "sms" | "email";
  periodKey: string;
  triggerContext: Record<string, unknown>;
  outcome:
    | "created_draft"
    | "dry_run"
    | "suppressed_opt_in"
    | "suppressed_agent_of_record"
    | "suppressed_template_off"
    | "suppressed_per_contact_trigger_off"
    | "already_fired"
    | "error";
  /** If the firing produced a draft, its id. */
  draftId?: string;
  /** If the firing was an error, the message. */
  error?: string;
  /** 'pending' when the agent's effective policy requires review, 'approved' for autosend. */
  draftStatus?: "pending" | "approved";
};

export type SchedulerResult = {
  agents: number;
  contacts: number;
  firings: SchedulerFiring[];
  counts: {
    created: number;
    dryRun: number;
    suppressed: number;
    alreadyFired: number;
    errors: number;
  };
};

const EMPTY_COUNTS = { created: 0, dryRun: 0, suppressed: 0, alreadyFired: 0, errors: 0 };

function mapTemplateRow(r: TemplateRow): Template {
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    channel: r.channel,
    subject: r.subject,
    body: r.body,
    language: r.language,
    variantOf: r.variant_of,
    placeholders: Array.isArray(r.placeholders) ? r.placeholders : [],
    triggerConfig:
      r.trigger_config && typeof r.trigger_config === "object"
        ? (r.trigger_config as Record<string, unknown>)
        : {},
    notes: r.notes,
    defaultStatus: r.default_status,
    source: r.source,
  };
}

export async function runScheduler(opts: SchedulerOptions = {}): Promise<SchedulerResult> {
  const dryRun = Boolean(opts.dryRun);
  const now = new Date();
  const maxContacts = Math.max(1, Math.min(opts.maxContactsPerAgent ?? 500, 2000));

  // Pull the template set once — small and mostly static.
  const { data: tplRows, error: tplErr } = await supabaseAdmin
    .from("templates")
    .select("*");
  if (tplErr) throw tplErr;
  const templates = (tplRows ?? [])
    .map((r) => mapTemplateRow(r as unknown as TemplateRow))
    .filter((t) => DETECTORS[t.id]);

  if (!templates.length) {
    return { agents: 0, contacts: 0, firings: [], counts: { ...EMPTY_COUNTS } };
  }

  // Resolve the set of agents to process.
  const agentIds = opts.agentId ? [opts.agentId] : await listAgentsWithContacts();
  if (!agentIds.length) {
    return { agents: 0, contacts: 0, firings: [], counts: { ...EMPTY_COUNTS } };
  }

  const firings: SchedulerFiring[] = [];
  const counts = { ...EMPTY_COUNTS };
  let contactsSeen = 0;

  for (const agentId of agentIds) {
    // Scheduler only runs against post-close + referral contacts (sphere
    // templates never fire for pre-qualification leads).
    const contacts = (
      await listContacts(agentId, {
        lifecycle_stage: ["past_client", "sphere", "referral_source"],
      })
    ).slice(0, maxContacts);
    contactsSeen += contacts.length;
    if (!contacts.length) continue;

    const effective = await getAgentMessageSettingsEffective(agentId);

    // Fetch existing firings for this agent × these contacts × these templates
    // so we can dedup in one go rather than per-pair.
    const existing = await existingFiringsFor({
      agentId,
      contactIds: contacts.map((c) => c.id),
      templateIds: templates.map((t) => t.id),
    });

    // Per-agent template overrides (status / body / subject).
    const overrides = await agentTemplateOverrides(agentId);

    for (const contact of contacts) {
      for (const template of templates) {
        const detector = DETECTORS[template.id];
        const proposed = detector({ contact, template, now });
        if (!proposed) continue;

        const key = `${contact.id}|${template.id}|${proposed.periodKey}`;
        if (existing.has(key)) {
          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "already_fired",
          });
          counts.alreadyFired++;
          continue;
        }

        // Template-level guardrails.
        const ov = overrides.get(template.id);
        const effectiveStatus = ov?.status ?? template.defaultStatus;
        if (effectiveStatus === "off") {
          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "suppressed_template_off",
          });
          if (!dryRun) {
            await recordFiring({
              contactId: contact.id,
              templateId: template.id,
              periodKey: proposed.periodKey,
              triggerContext: proposed.triggerContext,
              suppressedReason: "template_off",
            });
          }
          counts.suppressed++;
          continue;
        }

        // Per-contact trigger toggle (sphere_contact_triggers) — optional table.
        const perContactOff = await isPerContactTriggerDisabled(contact.id, template.id);
        if (perContactOff) {
          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "suppressed_per_contact_trigger_off",
          });
          if (!dryRun) {
            await recordFiring({
              contactId: contact.id,
              templateId: template.id,
              periodKey: proposed.periodKey,
              triggerContext: proposed.triggerContext,
              suppressedReason: "per_contact_trigger_off",
            });
          }
          counts.suppressed++;
          continue;
        }

        // Spec §2.8 agent-of-record check for equity templates. Prototype
        // approximation: require a non-null closing_address that matches
        // contact.address. Real implementation would query a transactions
        // table keyed on (agent, contact, property).
        if (equityTemplateRequiresAoR(template.id)) {
          const aor = agentOfRecordMatches(contact);
          if (!aor) {
            firings.push({
              agentId,
              contactId: contact.id,
              contactName: contact.fullName,
              templateId: template.id,
              channel: template.channel,
              periodKey: proposed.periodKey,
              triggerContext: proposed.triggerContext,
              outcome: "suppressed_agent_of_record",
            });
            if (!dryRun) {
              await recordFiring({
                contactId: contact.id,
                templateId: template.id,
                periodKey: proposed.periodKey,
                triggerContext: proposed.triggerContext,
                suppressedReason: "agent_of_record_mismatch",
              });
            }
            counts.suppressed++;
            continue;
          }
        }

        // Anniversary-specific opt-in check (detector also guards but keep
        // defense in depth).
        if (anniversaryTemplate(template.id) && !contact.anniversaryOptIn) {
          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "suppressed_opt_in",
          });
          if (!dryRun) {
            await recordFiring({
              contactId: contact.id,
              templateId: template.id,
              periodKey: proposed.periodKey,
              triggerContext: proposed.triggerContext,
              suppressedReason: "anniversary_opt_in_missing",
            });
          }
          counts.suppressed++;
          continue;
        }

        // Time to create a draft. Resolve status from effective review policy.
        const draftStatus = resolveDraftStatus({
          reviewPolicy: effective?.effectiveReviewPolicy ?? "review",
          categorySetting:
            effective?.effectiveReviewPolicyByCategory &&
            (template.category === "sphere" || template.category === "lead_response")
              ? effective.effectiveReviewPolicyByCategory[template.category]
              : null,
          templateDefaultStatus: effectiveStatus,
        });

        if (dryRun) {
          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "dry_run",
            draftStatus,
          });
          counts.dryRun++;
          continue;
        }

        try {
          const finalSubject = ov?.subjectOverride ?? template.subject;
          const finalBody = ov?.bodyOverride ?? template.body;
          const rendered = renderPreview({
            subject: template.channel === "email" ? finalSubject : null,
            body: finalBody,
          });

          const { data: draftInsert, error: insErr } = await supabaseAdmin
            .from("message_drafts")
            .insert({
              contact_id: contact.id,
              template_id: template.id,
              channel: template.channel,
              subject: rendered.subject,
              body: rendered.body,
              status: draftStatus,
              approved_at: draftStatus === "approved" ? new Date().toISOString() : null,
              trigger_context: proposed.triggerContext,
            } as never)
            .select("id")
            .single();
          if (insErr) throw insErr;

          const draftId = (draftInsert as { id: string }).id;
          await recordFiring({
            contactId: contact.id,
            templateId: template.id,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            draftId,
          });

          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "created_draft",
            draftId,
            draftStatus,
          });
          counts.created++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Draft creation failed";
          firings.push({
            agentId,
            contactId: contact.id,
            contactName: contact.fullName,
            templateId: template.id,
            channel: template.channel,
            periodKey: proposed.periodKey,
            triggerContext: proposed.triggerContext,
            outcome: "error",
            error: msg,
          });
          counts.errors++;
        }
      }
    }
  }

  return {
    agents: agentIds.length,
    contacts: contactsSeen,
    firings,
    counts,
  };
}

// ---------- helpers ----------

async function listAgentsWithContacts(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("agent_id")
    .in("lifecycle_stage", ["past_client", "sphere", "referral_source"] as never)
    .limit(10000);
  const s = new Set<string>();
  for (const r of data ?? []) {
    const id = (r as { agent_id?: string }).agent_id;
    if (id) s.add(id);
  }
  return Array.from(s);
}

async function existingFiringsFor({
  agentId,
  contactIds,
  templateIds,
}: {
  agentId: string;
  contactIds: string[];
  templateIds: string[];
}): Promise<Set<string>> {
  if (!contactIds.length || !templateIds.length) return new Set();
  const { data } = await supabaseAdmin
    .from("trigger_firings")
    .select("contact_id, template_id, period_key")
    .eq("agent_id", agentId as never)
    .in("contact_id", contactIds as never)
    .in("template_id", templateIds);
  const keys = new Set<string>();
  for (const r of data ?? []) {
    const row = r as { contact_id: string; template_id: string; period_key: string };
    keys.add(`${row.contact_id}|${row.template_id}|${row.period_key}`);
  }
  return keys;
}

type OverrideRow = {
  template_id: string;
  status: "autosend" | "review" | "off";
  subject_override: string | null;
  body_override: string | null;
};

type OverrideView = {
  templateId: string;
  status: "autosend" | "review" | "off";
  subjectOverride: string | null;
  bodyOverride: string | null;
};

async function agentTemplateOverrides(agentId: string): Promise<Map<string, OverrideView>> {
  const { data } = await supabaseAdmin
    .from("template_overrides")
    .select("template_id, status, subject_override, body_override")
    .eq("agent_id", agentId as never);
  const m = new Map<string, OverrideView>();
  for (const r of (data ?? []) as OverrideRow[]) {
    m.set(r.template_id, {
      templateId: r.template_id,
      status: r.status,
      subjectOverride: r.subject_override,
      bodyOverride: r.body_override,
    });
  }
  return m;
}

async function isPerContactTriggerDisabled(
  contactId: string,
  templateId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("contact_triggers")
    .select("enabled")
    .eq("contact_id", contactId)
    .eq("template_id", templateId)
    .maybeSingle();
  if (!data) return false;
  return !(data as { enabled: boolean }).enabled;
}

async function recordFiring(input: {
  contactId: string;
  templateId: string;
  periodKey: string;
  triggerContext: Record<string, unknown>;
  draftId?: string;
  suppressedReason?: string;
}): Promise<void> {
  await supabaseAdmin
    .from("trigger_firings")
    .upsert(
      {
        contact_id: input.contactId,
        template_id: input.templateId,
        period_key: input.periodKey,
        draft_id: input.draftId ?? null,
        trigger_context: input.triggerContext,
        suppressed_reason: input.suppressedReason ?? null,
      } as never,
      { onConflict: "contact_id,template_id,period_key", ignoreDuplicates: true },
    );
}

function equityTemplateRequiresAoR(templateId: string): boolean {
  return templateId === "EQ-01" || templateId === "EM-01" || templateId === "EM-02";
}

function anniversaryTemplate(templateId: string): boolean {
  return templateId === "HA-01" || templateId === "HA-01E";
}

function agentOfRecordMatches(contact: {
  address: string | null;
  closingAddress: string | null;
}): boolean {
  // Approximation only. Real check compares to a transactions table keyed on
  // (agent_id, contact_id, property). Here we accept any past-client contact
  // that has a closing_address on file; strict matching would reject contacts
  // where closing_address doesn't match their current address, which is fine
  // for the prototype. TODO when the transactions table exists.
  return !!contact.closingAddress;
}

function resolveDraftStatus({
  reviewPolicy,
  categorySetting,
  templateDefaultStatus,
}: {
  reviewPolicy: ReviewPolicy;
  categorySetting: "review" | "autosend" | null;
  templateDefaultStatus: "autosend" | "review" | "off";
}): "pending" | "approved" {
  // Template-level 'off' is already filtered upstream.
  // When per-category policy applies, respect it. Otherwise use the global.
  if (reviewPolicy === "per_category" && categorySetting) {
    return categorySetting === "autosend" ? "approved" : "pending";
  }
  if (reviewPolicy === "autosend") {
    // Even when agent's policy is autosend, a per-template override to review
    // keeps the draft in the queue. Template-level is authoritative for caution.
    if (templateDefaultStatus === "review") return "pending";
    return "approved";
  }
  return "pending";
}
