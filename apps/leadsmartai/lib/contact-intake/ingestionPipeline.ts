import { enrichLeadRecord } from "@/lib/contact-enrichment/enrichment";
import { mergeLeadRecords } from "@/lib/contact-enrichment/merge";
import {
  calculateContactCompletenessScore,
  displayAddress,
  displayPhone,
  normalizeAddress,
  normalizeEmail,
  normalizePhone,
} from "@/lib/contact-enrichment/normalize";
import { normalizeLeadFields } from "@/lib/contact-enrichment/service";
import type { LeadLike } from "@/lib/contact-enrichment/types";
import { runLeadMarketplacePipeline } from "@/lib/leadScorePipeline";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { findBestDuplicateMatchForAgent } from "./findDuplicateCandidates";
import { toLeadLike } from "./leadLike";
import { formatUsPhoneDigits } from "./phone";
import type { ContactFieldsInput, DuplicateStrategy, IngestResult, IntakeChannel } from "./types";

export type { ContactFieldsInput, DuplicateStrategy, IngestResult, IntakeChannel };

export async function assertLeadQuota(agentId: string, planType: string): Promise<void> {
  const pt = planType.toLowerCase();
  if (pt === "free") {
    throw new Error("CRM is not available on Free. Upgrade to Pro to add leads.");
  }
  if (pt === "pro") {
    const { count, error } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId);
    if (error) throw error;
    if ((count ?? 0) >= 500) {
      throw new Error("Upgrade to Premium for unlimited leads.");
    }
  }
}

async function logIntakeActivity(params: {
  leadId: string;
  agentId: string;
  intakeChannel: IntakeChannel;
  importJobId?: string | null;
  extra?: Record<string, unknown>;
}) {
  const leadIdNum = Number(params.leadId);
  if (!Number.isFinite(leadIdNum)) return;

  const aid = params.agentId?.trim();
  const row: Record<string, unknown> = {
    lead_id: leadIdNum,
    event_type: "contact_intake",
    metadata: {
      intake_channel: params.intakeChannel,
      import_job_id: params.importJobId ?? null,
      ...params.extra,
    },
  };
  if (aid) {
    row.agent_id = aid;
  }

  const { error } = await supabaseAdmin.from("lead_events").insert(row);

  if (error) console.error("[contact_intake] lead_events insert", error.message);
}

/**
 * Shared pipeline: duplicate check → insert or merge → normalize (service) → optional AI enrichment → marketplace pipeline → activity log.
 */
export async function runContactIngestion(params: {
  agentId: string;
  planType: string;
  fields: ContactFieldsInput;
  intakeChannel: IntakeChannel;
  duplicateStrategy: DuplicateStrategy;
  importJobId?: string | null;
  /** Bulk CSV: skip per-row OpenAI to stay fast (normalization still runs). */
  skipEnrichment?: boolean;
}): Promise<IngestResult> {
  const { agentId, planType, fields, intakeChannel, duplicateStrategy, importJobId, skipEnrichment } = params;

  const phoneDisplay = formatUsPhoneDigits(fields.phone ?? "");
  const incoming: LeadLike = toLeadLike({ ...fields, phone: phoneDisplay ?? fields.phone }, agentId);

  const dup = await findBestDuplicateMatchForAgent(agentId, incoming);

  if (dup && duplicateStrategy === "skip") {
    return { action: "skipped", duplicateLeadId: dup.leadId, score: dup.score };
  }

  if (dup && duplicateStrategy === "merge") {
    const { data: primaryRow, error: fetchErr } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", dup.leadId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!primaryRow) throw new Error("Duplicate lead not found for merge");

    const primary = primaryRow as LeadLike;
    const merged = mergeLeadRecords(primary, incoming);

    const { error: upErr } = await supabaseAdmin
      .from("leads")
      .update({
        ...merged,
        updated_at: new Date().toISOString(),
        intake_channel: intakeChannel,
        import_job_id: importJobId ?? null,
      } as Record<string, unknown>)
      .eq("id", dup.leadId);

    if (upErr) throw upErr;

    await normalizeLeadFields({ ...(primary as LeadLike), ...merged, id: dup.leadId });

    if (!skipEnrichment) {
      const { data: fresh } = await supabaseAdmin.from("leads").select("*").eq("id", dup.leadId).maybeSingle();
      if (fresh) {
        const enrichment = await enrichLeadRecord(fresh as LeadLike);
        const updatePayload: Record<string, unknown> = {
          contact_completeness_score: enrichment.contactCompletenessScore,
          enrichment_status: Object.keys(enrichment.changes).length ? "enriched" : "skipped_no_ai",
          updated_at: new Date().toISOString(),
        };
        for (const [k, v] of Object.entries(enrichment.changes)) {
          if (v !== undefined) updatePayload[k] = v;
        }
        await supabaseAdmin.from("leads").update(updatePayload).eq("id", dup.leadId);
      }
    }

    await logIntakeActivity({
      leadId: dup.leadId,
      agentId,
      intakeChannel,
      importJobId,
      extra: { merged_from_import: true, duplicate_match_score: dup.score },
    });

    return { action: "merged", leadId: dup.leadId };
  }

  await assertLeadQuota(agentId, planType);

  const ne = normalizeEmail(typeof fields.email === "string" ? fields.email : null);
  const np = phoneDisplay ? normalizePhone(phoneDisplay) : null;
  const na = normalizeAddress(displayAddress(incoming));

  const insertPayload: Record<string, unknown> = {
    agent_id: agentId,
    name: fields.name?.trim() || null,
    email: fields.email?.trim() || null,
    phone: phoneDisplay,
    phone_number: phoneDisplay,
    property_address: fields.property_address?.trim() || null,
    source: fields.source?.trim() || "crm",
    intake_channel: intakeChannel,
    import_job_id: importJobId ?? null,
    notes: fields.notes?.trim() || null,
    normalized_email: ne,
    normalized_phone: np,
    normalized_address: na,
    contact_completeness_score: calculateContactCompletenessScore(incoming),
    lead_status: "new",
    rating: "warm",
    contact_frequency: "weekly",
    contact_method: "email",
    sms_opt_in: false,
    next_contact_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insErr) throw insErr;

  const leadId = String((inserted as { id?: unknown })?.id ?? "");
  if (!leadId) throw new Error("Insert failed");

  const withId: LeadLike = { ...incoming, id: leadId };
  await normalizeLeadFields(withId);

  if (!skipEnrichment) {
    const { data: row } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (row) {
      const enrichment = await enrichLeadRecord(row as LeadLike);
      const updatePayload: Record<string, unknown> = {
        contact_completeness_score: enrichment.contactCompletenessScore,
        enrichment_status: Object.keys(enrichment.changes).length ? "enriched" : "skipped_no_ai",
        updated_at: new Date().toISOString(),
      };
      for (const [k, v] of Object.entries(enrichment.changes)) {
        if (v !== undefined) updatePayload[k] = v;
      }
      await supabaseAdmin.from("leads").update(updatePayload).eq("id", leadId);

      await supabaseAdmin.from("lead_enrichment_runs").insert({
        lead_id: leadId,
        run_type: "enrichment",
        status: "completed",
        changes_json: enrichment.changes,
      } as Record<string, unknown>);
    }
  }

  try {
    await runLeadMarketplacePipeline(leadId);
  } catch (e) {
    console.warn("[ingest] runLeadMarketplacePipeline", e);
  }

  await logIntakeActivity({
    leadId,
    agentId,
    intakeChannel,
    importJobId,
    extra: { duplicate_ignored: Boolean(dup && duplicateStrategy === "create_anyway") },
  });

  return { action: "inserted", leadId };
}
