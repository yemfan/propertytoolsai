import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderPreview } from "@/lib/templates/preview";
import type {
  DraftChannel,
  DraftStatus,
  MessageDraft,
  MessageDraftRow,
  MessageDraftView,
} from "./types";

function mapRow(row: MessageDraftRow): MessageDraft {
  return {
    id: row.id,
    contactId: row.contact_id,
    templateId: row.template_id,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    status: row.status,
    triggerContext:
      row.trigger_context && typeof row.trigger_context === "object"
        ? row.trigger_context
        : {},
    edited: row.edited,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    rejectedReason: row.rejected_reason,
    sentAt: row.sent_at,
    failedAt: row.failed_at,
    failureReason: row.failure_reason,
    scheduledFor: row.scheduled_for,
  };
}

function initialsFor(first: string, last: string | null): string {
  return (first[0] ?? "").toUpperCase() + (last?.[0] ?? "").toUpperCase();
}

/**
 * `message_drafts` / `templates` / `sphere_contacts` come from migrations
 * 20260479100000 / 20260479200000 / 20260479300000. If a deploy environment
 * hasn't run them yet, the queries below would throw "relation does not
 * exist" and crash the drafts dashboard. We detect that specific class of
 * error and return an empty state so the page renders the "no drafts
 * waiting" copy instead of a red error boundary.
 */
function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");
}

export async function listDrafts(
  agentId: string,
  status: DraftStatus | "all" = "pending",
): Promise<MessageDraftView[]> {
  let q = supabaseAdmin
    .from("message_drafts")
    .select(
      "*, sphere_contacts!inner(id, first_name, last_name, phone, email, avatar_color), templates(id, name, category)",
    )
    .eq("agent_id", agentId as never)
    .order("created_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    if (isMissingRelationError(error)) {
      console.warn("[drafts] message_drafts or joined table not reachable — rendering empty state", {
        code: (error as { code?: string }).code,
      });
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown> & {
      sphere_contacts: {
        id: string;
        first_name: string;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        avatar_color: string | null;
      };
      templates: { id: string; name: string; category: string } | null;
    };
    const draft = mapRow(r as unknown as MessageDraftRow);
    const first = r.sphere_contacts.first_name;
    const last = r.sphere_contacts.last_name;
    return {
      ...draft,
      contactFirstName: first,
      contactLastName: last,
      contactFullName: last ? `${first} ${last}` : first,
      contactInitials: initialsFor(first, last) || first.slice(0, 2).toUpperCase(),
      contactAvatarColor: r.sphere_contacts.avatar_color,
      contactPhone: r.sphere_contacts.phone,
      contactEmail: r.sphere_contacts.email,
      templateName: r.templates?.name ?? null,
      templateCategory: r.templates?.category ?? null,
    };
  });
}

export async function getDraft(
  agentId: string,
  draftId: string,
): Promise<MessageDraft | null> {
  const { data } = await supabaseAdmin
    .from("message_drafts")
    .select("*")
    .eq("agent_id", agentId as never)
    .eq("id", draftId)
    .maybeSingle();
  return data ? mapRow(data as unknown as MessageDraftRow) : null;
}

async function assertContactBelongsToAgent(agentId: string, contactId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("sphere_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!data) throw new Error("Contact does not belong to this agent");
}

/**
 * Generate a draft from a template + contact. This is what the real trigger
 * scheduler would do; for now it's invoked manually via the contact profile
 * "Generate draft" button so the approval flow can be tested end-to-end.
 */
export async function createDraftFromTemplate(
  agentId: string,
  contactId: string,
  templateId: string,
  triggerContext: Record<string, unknown> = { source: "manual_generate" },
): Promise<MessageDraft> {
  await assertContactBelongsToAgent(agentId, contactId);

  const { data: tpl } = await supabaseAdmin
    .from("templates")
    .select("id, channel, subject, body")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) throw new Error("Template not found");

  const t = tpl as { id: string; channel: DraftChannel; subject: string | null; body: string };

  // Per-agent override if present
  const { data: ov } = await supabaseAdmin
    .from("template_overrides")
    .select("subject_override, body_override")
    .eq("agent_id", agentId as never)
    .eq("template_id", templateId)
    .maybeSingle();
  const finalSubject =
    (ov as { subject_override?: string | null } | null)?.subject_override ?? t.subject;
  const finalBody =
    (ov as { body_override?: string | null } | null)?.body_override ?? t.body;

  // Render with the mocked archetype. Production should fill from the actual
  // contact row + AVM + agent profile — that's a bigger workstream.
  const rendered = renderPreview({
    subject: t.channel === "email" ? finalSubject : null,
    body: finalBody,
  });

  const { data, error } = await supabaseAdmin
    .from("message_drafts")
    .insert({
      contact_id: contactId,
      template_id: templateId,
      channel: t.channel,
      subject: rendered.subject,
      body: rendered.body,
      trigger_context: triggerContext,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as unknown as MessageDraftRow);
}

export async function createAdhocDraft(
  agentId: string,
  contactId: string,
  channel: DraftChannel,
  subject: string | null,
  body: string,
  triggerContext: Record<string, unknown> = { source: "adhoc" },
): Promise<MessageDraft> {
  await assertContactBelongsToAgent(agentId, contactId);
  const { data, error } = await supabaseAdmin
    .from("message_drafts")
    .insert({
      contact_id: contactId,
      channel,
      subject: channel === "email" ? subject : null,
      body,
      trigger_context: triggerContext,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as unknown as MessageDraftRow);
}

async function assertDraftBelongsToAgent(agentId: string, draftId: string): Promise<MessageDraft> {
  const draft = await getDraft(agentId, draftId);
  if (!draft) throw new Error("Draft does not belong to this agent");
  return draft;
}

export async function approveDraft(agentId: string, draftId: string): Promise<void> {
  const draft = await assertDraftBelongsToAgent(agentId, draftId);
  if (draft.status !== "pending") {
    throw new Error(`Cannot approve a draft in status '${draft.status}'`);
  }
  // The real sender worker reads `status='approved'` rows and dispatches via
  // Twilio / SendGrid. That integration isn't in this PR; for now the draft
  // moves to 'approved' and stays there. Flip `sent_at` manually when the
  // worker lands.
  const { error } = await supabaseAdmin
    .from("message_drafts")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
    } as never)
    .eq("id", draftId);
  if (error) throw error;
}

export async function rejectDraft(
  agentId: string,
  draftId: string,
  reason: string | null,
): Promise<void> {
  const draft = await assertDraftBelongsToAgent(agentId, draftId);
  if (draft.status !== "pending") {
    throw new Error(`Cannot reject a draft in status '${draft.status}'`);
  }
  const { error } = await supabaseAdmin
    .from("message_drafts")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_reason: reason?.trim().slice(0, 500) || null,
    } as never)
    .eq("id", draftId);
  if (error) throw error;
}

export async function editDraft(
  agentId: string,
  draftId: string,
  patch: { subject?: string | null; body?: string },
): Promise<MessageDraft> {
  const draft = await assertDraftBelongsToAgent(agentId, draftId);
  if (draft.status !== "pending") {
    throw new Error(`Cannot edit a draft in status '${draft.status}'`);
  }
  const update: Record<string, unknown> = { edited: true };
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.body !== undefined) update.body = patch.body;
  const { data, error } = await supabaseAdmin
    .from("message_drafts")
    .update(update as never)
    .eq("id", draftId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as unknown as MessageDraftRow);
}

export async function countPendingDrafts(agentId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("message_drafts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId as never)
    .eq("status", "pending");
  if (error) return 0; // fail-open for the header badge
  return count ?? 0;
}
