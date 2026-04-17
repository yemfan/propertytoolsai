import { supabaseAdmin } from "@/lib/supabase/admin";

export type FiringOutcomeFilter =
  | "all"
  | "created"
  | "suppressed"
  | "suppressed_opt_in"
  | "suppressed_agent_of_record"
  | "suppressed_template_off"
  | "suppressed_per_contact_trigger_off"
  | "suppressed_other";

export type FiringRange = "24h" | "7d" | "30d" | "all";

export type FiringRow = {
  id: string;
  contactId: string;
  contactFirstName: string;
  contactLastName: string | null;
  contactFullName: string;
  contactAvatarColor: string | null;
  templateId: string;
  templateName: string | null;
  templateCategory: string | null;
  templateChannel: string | null;
  periodKey: string;
  draftId: string | null;
  draftStatus: string | null;
  suppressedReason: string | null;
  triggerContext: Record<string, unknown>;
  firedAt: string;
};

export type FiringsPage = {
  rows: FiringRow[];
  hasMore: boolean;
  nextCursor: string | null;
};

function rangeCutoff(range: FiringRange): string | null {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

function initialsFor(first: string, last: string | null): string {
  return (first[0] ?? "").toUpperCase() + (last?.[0] ?? "").toUpperCase();
}

export async function listFiringsForAgent(
  agentId: string,
  opts: {
    outcome?: FiringOutcomeFilter;
    range?: FiringRange;
    limit?: number;
    /** ISO of the fired_at boundary for pagination. Fetches rows older than this. */
    before?: string;
  } = {},
): Promise<FiringsPage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const outcome = opts.outcome ?? "all";

  let q = supabaseAdmin
    .from("trigger_firings")
    .select(
      "id, contact_id, template_id, period_key, draft_id, suppressed_reason, trigger_context, fired_at, " +
        "sphere_contacts!inner(first_name, last_name, avatar_color), " +
        "templates(name, category, channel), " +
        "message_drafts(status)",
    )
    .eq("agent_id", agentId as never)
    .order("fired_at", { ascending: false })
    .limit(limit + 1);

  const cutoff = rangeCutoff(opts.range ?? "30d");
  if (cutoff) q = q.gte("fired_at", cutoff);
  if (opts.before) q = q.lt("fired_at", opts.before);

  if (outcome === "created") q = q.not("draft_id", "is", null);
  else if (outcome === "suppressed") q = q.not("suppressed_reason", "is", null);
  else if (outcome === "suppressed_opt_in") q = q.eq("suppressed_reason", "anniversary_opt_in_missing");
  else if (outcome === "suppressed_agent_of_record") q = q.eq("suppressed_reason", "agent_of_record_mismatch");
  else if (outcome === "suppressed_template_off") q = q.eq("suppressed_reason", "template_off");
  else if (outcome === "suppressed_per_contact_trigger_off") q = q.eq("suppressed_reason", "per_contact_trigger_off");
  else if (outcome === "suppressed_other") {
    // "other" = suppressed for a reason that isn't one of the named ones above.
    q = q
      .not("suppressed_reason", "is", null)
      .not(
        "suppressed_reason",
        "in",
        "(anniversary_opt_in_missing,agent_of_record_mismatch,template_off,per_contact_trigger_off)",
      );
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []).map((r) => {
    const raw = r as unknown as Record<string, unknown> & {
      sphere_contacts: {
        first_name: string;
        last_name: string | null;
        avatar_color: string | null;
      };
      templates: { name: string; category: string; channel: string } | null;
      message_drafts: { status: string } | null;
    };
    const first = raw.sphere_contacts.first_name;
    const last = raw.sphere_contacts.last_name;
    return {
      id: String(raw.id),
      contactId: String(raw.contact_id),
      contactFirstName: first,
      contactLastName: last,
      contactFullName: last ? `${first} ${last}` : first,
      contactAvatarColor: raw.sphere_contacts.avatar_color,
      contactInitials: initialsFor(first, last),
      templateId: String(raw.template_id),
      templateName: raw.templates?.name ?? null,
      templateCategory: raw.templates?.category ?? null,
      templateChannel: raw.templates?.channel ?? null,
      periodKey: String(raw.period_key),
      draftId: (raw.draft_id as string | null) ?? null,
      draftStatus: raw.message_drafts?.status ?? null,
      suppressedReason: (raw.suppressed_reason as string | null) ?? null,
      triggerContext:
        raw.trigger_context && typeof raw.trigger_context === "object"
          ? (raw.trigger_context as Record<string, unknown>)
          : {},
      firedAt: String(raw.fired_at),
    } as FiringRow & { contactInitials: string };
  });

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].firedAt : null;
  return { rows: trimmed, hasMore, nextCursor };
}
