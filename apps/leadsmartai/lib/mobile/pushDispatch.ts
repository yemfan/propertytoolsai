import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendExpoPushMessages, type ExpoPushMessage } from "@/lib/mobile/expoPushSend";
import { listExpoPushTokensForUser } from "@/lib/mobile/pushTokens";

const INBOUND_PUSH_DEDUPE_MS = 120_000;
const NEEDS_HUMAN_PUSH_DEDUPE_MS = 180_000;
const REMINDER_PUSH_DEDUPE_MS = 86_400_000;

function mobilePushGloballyDisabled() {
  return process.env.MOBILE_PUSH_ENABLED === "false";
}

async function getAuthUserIdForAgent(agentId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("auth_user_id")
    .eq("id", agentId as unknown as number)
    .maybeSingle();

  if (error || !data) return null;
  const uid = (data as { auth_user_id?: string | null }).auth_user_id;
  return uid ? String(uid) : null;
}

async function wasRecentLeadEvent(leadId: string, eventType: string, sinceMs: number): Promise<boolean> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { data } = await supabaseAdmin
    .from("lead_events")
    .select("id")
    .eq("lead_id", leadId)
    .eq("event_type", eventType)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

async function logLeadEventBestEffort(params: {
  leadId: string;
  agentId: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("lead_events").insert({
      lead_id: params.leadId,
      agent_id: params.agentId ?? null,
      event_type: params.eventType,
      metadata: params.metadata ?? {},
    } as Record<string, unknown>);
  } catch {
    // ignore
  }
}

function buildMessages(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): ExpoPushMessage[] {
  return tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
  }));
}

/** Hot lead alert (alongside optional SMS agent notify). Returns whether any push was sent. */
export async function dispatchMobileHotLeadPush(params: {
  userId: string;
  agentId: string | null;
  leadId: string;
  title: string;
  body: string;
}): Promise<boolean> {
  if (mobilePushGloballyDisabled() || process.env.MOBILE_PUSH_HOT_LEAD === "false") return false;

  const tokens = await listExpoPushTokensForUser(params.userId);
  if (!tokens.length) return false;

  await sendExpoPushMessages(
    buildMessages(tokens, params.title, params.body, {
      kind: "hot_lead",
      leadId: params.leadId,
    })
  );

  await logLeadEventBestEffort({
    leadId: params.leadId,
    agentId: params.agentId,
    eventType: "mobile_push_hot_lead",
    metadata: { title: params.title.slice(0, 80) },
  });

  return true;
}

/** New inbound SMS (throttled per lead). */
export async function dispatchMobileInboundSmsPush(params: {
  agentId: string;
  leadId: string;
  leadName: string | null;
  preview: string;
}): Promise<void> {
  if (mobilePushGloballyDisabled() || process.env.MOBILE_PUSH_INBOUND_SMS === "false") return;

  if (await wasRecentLeadEvent(params.leadId, "mobile_push_inbound_sms", INBOUND_PUSH_DEDUPE_MS)) {
    return;
  }

  const userId = await getAuthUserIdForAgent(params.agentId);
  if (!userId) return;

  const tokens = await listExpoPushTokensForUser(userId);
  if (!tokens.length) return;

  const name = params.leadName?.trim() || "Lead";
  const preview = params.preview.trim().slice(0, 140);
  const title = "New SMS — LeadSmart";
  const body = preview ? `${name}: ${preview}` : `${name} sent a text.`;

  await sendExpoPushMessages(
    buildMessages(tokens, title, body, {
      kind: "inbound_sms",
      leadId: params.leadId,
    })
  );

  await logLeadEventBestEffort({
    leadId: params.leadId,
    agentId: params.agentId,
    eventType: "mobile_push_inbound_sms",
    metadata: { channel: "sms" },
  });
}

/** New inbound email (throttled per lead). */
export async function dispatchMobileInboundEmailPush(params: {
  agentId: string;
  leadId: string;
  leadName: string | null;
  subject: string;
  preview: string;
}): Promise<void> {
  if (mobilePushGloballyDisabled() || process.env.MOBILE_PUSH_INBOUND_EMAIL === "false") return;

  if (await wasRecentLeadEvent(params.leadId, "mobile_push_inbound_email", INBOUND_PUSH_DEDUPE_MS)) {
    return;
  }

  const userId = await getAuthUserIdForAgent(params.agentId);
  if (!userId) return;

  const tokens = await listExpoPushTokensForUser(userId);
  if (!tokens.length) return;

  const name = params.leadName?.trim() || "Lead";
  const sub = params.subject.trim().slice(0, 80);
  const title = "New email — LeadSmart";
  const body = sub ? `${name}: ${sub}` : `${name} sent an email.`;

  await sendExpoPushMessages(
    buildMessages(tokens, title, body, {
      kind: "inbound_email",
      leadId: params.leadId,
    })
  );

  await logLeadEventBestEffort({
    leadId: params.leadId,
    agentId: params.agentId,
    eventType: "mobile_push_inbound_email",
    metadata: { channel: "email", preview: params.preview.slice(0, 200) },
  });
}

/**
 * AI explicitly requested a human (distinct from generic hot-lead scoring in some cases).
 * Throttled per lead to avoid duplicate alerts with rapid messages.
 */
export async function dispatchMobileNeedsHumanPush(params: {
  agentId: string;
  leadId: string;
  leadName: string | null;
  channel: "sms" | "email";
  reason: string;
}): Promise<void> {
  if (mobilePushGloballyDisabled() || process.env.MOBILE_PUSH_NEEDS_HUMAN === "false") return;

  if (await wasRecentLeadEvent(params.leadId, "mobile_push_needs_human", NEEDS_HUMAN_PUSH_DEDUPE_MS)) {
    return;
  }

  const userId = await getAuthUserIdForAgent(params.agentId);
  if (!userId) return;

  const tokens = await listExpoPushTokensForUser(userId);
  if (!tokens.length) return;

  const name = params.leadName?.trim() || "Lead";
  const reason = params.reason.trim().slice(0, 160);
  const title = "AI needs you — LeadSmart";
  const body = reason ? `${name} · ${reason}` : `${name}: please review this conversation.`;

  await sendExpoPushMessages(
    buildMessages(tokens, title, body, {
      kind: "needs_human",
      leadId: params.leadId,
      channel: params.channel,
      reason: reason || "review",
    })
  );

  await logLeadEventBestEffort({
    leadId: params.leadId,
    agentId: params.agentId,
    eventType: "mobile_push_needs_human",
    metadata: { channel: params.channel },
  });
}

/** Scheduled follow-up due (cron). Deduped ~1× per lead per day. */
export async function dispatchMobileReminderPush(params: {
  agentId: string;
  leadId: string;
  leadName: string | null;
  hint?: string;
}): Promise<void> {
  if (mobilePushGloballyDisabled() || process.env.MOBILE_PUSH_REMINDER === "false") return;

  if (await wasRecentLeadEvent(params.leadId, "mobile_push_reminder", REMINDER_PUSH_DEDUPE_MS)) {
    return;
  }

  const userId = await getAuthUserIdForAgent(params.agentId);
  if (!userId) return;

  const tokens = await listExpoPushTokensForUser(userId);
  if (!tokens.length) return;

  const name = params.leadName?.trim() || "Lead";
  const title = "Follow-up due — LeadSmart";
  const body = params.hint?.trim()
    ? `${name}: ${params.hint.trim().slice(0, 140)}`
    : `${name}: time to reach out.`;

  await sendExpoPushMessages(
    buildMessages(tokens, title, body, {
      kind: "reminder",
      leadId: params.leadId,
    })
  );

  await logLeadEventBestEffort({
    leadId: params.leadId,
    agentId: params.agentId,
    eventType: "mobile_push_reminder",
    metadata: {},
  });
}
