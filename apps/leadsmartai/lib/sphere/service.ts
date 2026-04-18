import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  SphereContact,
  SphereContactView,
  SphereRelationshipType,
  SphereSignal,
  SphereSignalType,
} from "./types";

const AVATAR_PALETTE = [
  "#8F4A2E",
  "#5C4A3E",
  "#6B5D4E",
  "#7A5B42",
  "#4A3E33",
  "#6B4A3E",
];

function avatarFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsFor(first: string, last: string | null): string {
  return (first[0] ?? "").toUpperCase() + (last?.[0] ?? "").toUpperCase();
}

function daysBetween(isoLeft: string, isoRight: string): number {
  const ms = new Date(isoLeft).getTime() - new Date(isoRight).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function mapContactRow(row: Record<string, unknown>): SphereContact {
  const firstName = String(row.first_name ?? "");
  const lastName = row.last_name ? String(row.last_name) : null;
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  return {
    id: String(row.id),
    firstName,
    lastName,
    fullName,
    initials: initialsFor(firstName, lastName) || firstName.slice(0, 2).toUpperCase(),
    avatarColor: (row.avatar_color as string | null) ?? avatarFor(String(row.id)),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    closingAddress: (row.closing_address as string | null) ?? null,
    closingDate: (row.closing_date as string | null) ?? null,
    closingPrice: row.closing_price === null ? null : Number(row.closing_price),
    avmCurrent: row.avm_current === null ? null : Number(row.avm_current),
    avmUpdatedAt: (row.avm_updated_at as string | null) ?? null,
    relationshipType: (row.relationship_type as SphereRelationshipType) ?? "sphere_non_client",
    relationshipTag: (row.relationship_tag as string | null) ?? null,
    anniversaryOptIn: !!row.anniversary_opt_in,
    preferredLanguage: (row.preferred_language as "en" | "zh") ?? "en",
    lastTouchDate: (row.last_touch_date as string | null) ?? null,
    doNotContactSms: !!row.do_not_contact_sms,
    doNotContactEmail: !!row.do_not_contact_email,
  };
}

function mapSignalRow(row: Record<string, unknown>): SphereSignal {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    type: (row.signal_type as SphereSignalType) ?? "life_event_other",
    label: String(row.label ?? ""),
    confidence: (row.confidence as SphereSignal["confidence"]) ?? "medium",
    suggestedAction: (row.suggested_action as string | null) ?? null,
    payload:
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
    detectedAt: String(row.detected_at ?? new Date().toISOString()),
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    dismissedAt: (row.dismissed_at as string | null) ?? null,
  };
}

/**
 * Score a contact for the "who to touch today" ranked list. Signals > anniversaries
 * (within 60 days) > equity milestones > dormancy > referrer overdue.
 *
 * Thresholds per the sphere prototype — spec §2.4 trigger library was empty so
 * these are [ASSUMED]. Product should confirm before launch.
 */
function rankContact(c: SphereContact, signals: SphereSignal[], today: Date): SphereContactView {
  const nowIso = today.toISOString();
  const dormancyDays =
    c.lastTouchDate !== null ? daysBetween(nowIso, c.lastTouchDate) : null;

  let equityDelta: number | null = null;
  let equityPct: number | null = null;
  if (c.avmCurrent !== null && c.closingPrice !== null && c.closingPrice > 0) {
    equityDelta = c.avmCurrent - c.closingPrice;
    equityPct = equityDelta / c.closingPrice;
  }

  let reasonType: SphereContactView["reasonType"] = "none";
  let topReason = "";
  let priority = 999;

  const openSignals = signals.filter((s) => !s.dismissedAt);

  if (openSignals.some((s) => s.type === "equity_milestone")) {
    reasonType = "equity_milestone";
    topReason = "Crossed equity milestone";
    priority = 15;
  } else if (openSignals.some((s) => s.type === "refi_detected")) {
    reasonType = "life_event";
    topReason = "Refi detected";
    priority = 20;
  } else if (openSignals.some((s) => s.type === "job_change")) {
    reasonType = "life_event";
    topReason = "Job change detected";
    priority = 10;
  } else if (c.closingDate && c.anniversaryOptIn) {
    const days = Math.abs(daysYearAgoDiff(c.closingDate, today));
    if (days <= 45) {
      reasonType = "anniversary";
      topReason = days === 0 ? "Home anniversary today" : `Home anniversary · ${days}d`;
      priority = 30 + days;
    }
  }

  if (reasonType === "none") {
    if (dormancyDays !== null && dormancyDays >= 120) {
      reasonType = "dormant";
      topReason = `Dormant ${dormancyDays}d`;
      priority = 300 + dormancyDays;
    } else if (c.relationshipType === "referral_source" && dormancyDays !== null && dormancyDays >= 60) {
      reasonType = "referral_overdue";
      topReason = "Top referrer · overdue";
      priority = 250;
    } else {
      topReason = relationshipLabel(c.relationshipType);
      priority = 900;
    }
  }

  return {
    ...c,
    equityDelta,
    equityPct,
    dormancyDays,
    topReason,
    reasonType,
    priority,
    signals: openSignals,
  };
}

function daysYearAgoDiff(closingIso: string, today: Date): number {
  const d = new Date(closingIso);
  const anniversary = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((anniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function relationshipLabel(t: SphereRelationshipType): string {
  switch (t) {
    case "past_buyer_client":
      return "Past buyer · client";
    case "past_seller_client":
      return "Past seller · client";
    case "sphere_non_client":
      return "Sphere";
    case "referral_source":
      return "Referrer";
  }
}

/**
 * `sphere_contacts` / `sphere_signals` / `sphere_contact_triggers` are seeded
 * by migration 20260479200000_sphere_module.sql. If a deploy environment hasn't
 * run that migration yet, the read queries below return a PostgREST error
 * like 42P01 "relation does not exist" — which previously threw and triggered
 * the dashboard error boundary. We now log and fall through to the empty-state
 * UI instead, so unseeded environments get "No sphere contacts yet" rather
 * than a red crash banner.
 */
function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  // 42P01 = undefined_table, 42703 = undefined_column. Both happen when a
  // migration is partially applied (table exists but a column is missing, or
  // vice versa). PostgREST's "schema cache" message appears when its cached
  // introspection hasn't picked up a newly-applied migration yet.
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    /does not exist|schema cache/i.test(e.message ?? "")
  );
}

export async function listSphereContacts(agentId: string): Promise<SphereContactView[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("sphere_contacts")
    .select("*")
    .eq("agent_id", agentId as never);
  if (error) {
    if (isMissingRelationError(error)) {
      console.warn("[sphere] sphere_contacts table not reachable — rendering empty state", {
        code: (error as { code?: string }).code,
      });
      return [];
    }
    throw error;
  }
  if (!rows?.length) return [];

  const contactIds = rows.map((r) => String((r as { id: string }).id));
  const { data: signalRows, error: signalErr } = await supabaseAdmin
    .from("sphere_signals")
    .select("*")
    .in("contact_id", contactIds as never)
    .is("dismissed_at", null);
  if (signalErr && !isMissingRelationError(signalErr)) {
    // Rethrow only unexpected errors; missing-relation/column falls through
    // so the contacts list still renders without signal chips.
    throw signalErr;
  }
  const signalsByContact = new Map<string, SphereSignal[]>();
  for (const sr of signalRows ?? []) {
    const s = mapSignalRow(sr as Record<string, unknown>);
    if (!signalsByContact.has(s.contactId)) signalsByContact.set(s.contactId, []);
    signalsByContact.get(s.contactId)!.push(s);
  }

  const today = new Date();
  const views = rows.map((r) => {
    const c = mapContactRow(r as Record<string, unknown>);
    const sigs = signalsByContact.get(c.id) ?? [];
    return rankContact(c, sigs, today);
  });
  views.sort((a, b) => a.priority - b.priority);
  return views;
}

export async function getSphereContact(
  agentId: string,
  contactId: string,
): Promise<SphereContactView | null> {
  const { data: row, error } = await supabaseAdmin
    .from("sphere_contacts")
    .select("*")
    .eq("agent_id", agentId as never)
    .eq("id", contactId)
    .maybeSingle();
  if (error && isMissingRelationError(error)) return null;
  if (!row) return null;
  const { data: signalRows } = await supabaseAdmin
    .from("sphere_signals")
    .select("*")
    .eq("contact_id", contactId);
  const signals = (signalRows ?? []).map((r) => mapSignalRow(r as Record<string, unknown>));
  return rankContact(mapContactRow(row as Record<string, unknown>), signals, new Date());
}

export async function listOpenSignals(agentId: string): Promise<
  Array<SphereSignal & { contact: SphereContact }>
> {
  // Two-step: fetch agent's contacts + signals separately to avoid deep joins.
  const { data: contactRows, error: contactErr } = await supabaseAdmin
    .from("sphere_contacts")
    .select("*")
    .eq("agent_id", agentId as never);
  if (contactErr && isMissingRelationError(contactErr)) return [];
  if (!contactRows?.length) return [];
  const contactsById = new Map<string, SphereContact>();
  for (const row of contactRows) {
    const c = mapContactRow(row as Record<string, unknown>);
    contactsById.set(c.id, c);
  }
  const { data: signalRows } = await supabaseAdmin
    .from("sphere_signals")
    .select("*")
    .in("contact_id", Array.from(contactsById.keys()) as never)
    .is("dismissed_at", null);
  return (signalRows ?? [])
    .map((r) => {
      const s = mapSignalRow(r as Record<string, unknown>);
      const contact = contactsById.get(s.contactId);
      if (!contact) return null;
      return { ...s, contact };
    })
    .filter((v): v is SphereSignal & { contact: SphereContact } => v !== null);
}

async function assertSignalBelongsToAgent(
  agentId: string,
  signalId: string,
): Promise<void> {
  const { data: signal } = await supabaseAdmin
    .from("sphere_signals")
    .select("id, contact_id")
    .eq("id", signalId)
    .maybeSingle();
  if (!signal) throw new Error("Signal not found");
  const { data: contact } = await supabaseAdmin
    .from("sphere_contacts")
    .select("id")
    .eq("id", (signal as { contact_id: string }).contact_id)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!contact) throw new Error("Signal does not belong to this agent");
}

async function assertContactBelongsToAgent(
  agentId: string,
  contactId: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("sphere_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!data) throw new Error("Contact does not belong to this agent");
}

export async function dismissSignal(agentId: string, signalId: string): Promise<void> {
  await assertSignalBelongsToAgent(agentId, signalId);
  const { error } = await supabaseAdmin
    .from("sphere_signals")
    .update({ dismissed_at: new Date().toISOString() } as never)
    .eq("id", signalId);
  if (error) throw error;
}

export async function acknowledgeSignal(agentId: string, signalId: string): Promise<void> {
  await assertSignalBelongsToAgent(agentId, signalId);
  const { error } = await supabaseAdmin
    .from("sphere_signals")
    .update({ acknowledged_at: new Date().toISOString() } as never)
    .eq("id", signalId);
  if (error) throw error;
}

export async function restoreSignal(agentId: string, signalId: string): Promise<void> {
  await assertSignalBelongsToAgent(agentId, signalId);
  const { error } = await supabaseAdmin
    .from("sphere_signals")
    .update({ dismissed_at: null, acknowledged_at: null } as never)
    .eq("id", signalId);
  if (error) throw error;
}

export type CreateSignalInput = {
  contactId: string;
  type: SphereSignal["type"];
  label: string;
  confidence?: SphereSignal["confidence"];
  suggestedAction?: string | null;
  detectedAt?: string; // ISO; defaults to now
};

export async function createSignal(
  agentId: string,
  input: CreateSignalInput,
): Promise<SphereSignal> {
  await assertContactBelongsToAgent(agentId, input.contactId);
  const { data, error } = await supabaseAdmin
    .from("sphere_signals")
    .insert({
      contact_id: input.contactId,
      signal_type: input.type,
      label: input.label.trim().slice(0, 200),
      confidence: input.confidence ?? "medium",
      suggested_action: input.suggestedAction?.trim().slice(0, 500) || null,
      detected_at: input.detectedAt ?? new Date().toISOString(),
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return mapSignalRow(data as unknown as Record<string, unknown>);
}

export function currencyFormat(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

export function percentFormat(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}
