import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendExpoPushMessages, type ExpoPushMessage } from "@/lib/mobile/expoPushSend";
import { listExpoPushTokensForUser } from "@/lib/mobile/pushTokens";
import {
  getAgentNotificationPreferences,
  updateManyInboxPushSentAt,
} from "@/lib/notifications/agentNotifications";

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

type PendingRow = {
  id: string;
  agent_id: number;
  title: string;
  body: string;
};

/**
 * Batches low-priority reminder inbox rows into one Expo push per agent.
 * Run on a schedule (e.g. every 15 min). Hot leads and missed calls are not handled here.
 */
export async function processReminderNotificationDigest(): Promise<{
  agentsProcessed: number;
  pushesSent: number;
  rowsClosed: number;
}> {
  if (mobilePushGloballyDisabled() || process.env.MOBILE_PUSH_REMINDER === "false") {
    return { agentsProcessed: 0, pushesSent: 0, rowsClosed: 0 };
  }

  const graceIso = new Date(Date.now() - 90_000).toISOString();

  const { data: pending, error } = await supabaseAdmin
    .from("agent_inbox_notifications")
    .select("id, agent_id, title, body")
    .eq("type", "reminder")
    .is("push_sent_at", null)
    .lte("created_at", graceIso);

  if (error) throw new Error(error.message);
  const rows = (pending ?? []) as PendingRow[];
  if (!rows.length) {
    return { agentsProcessed: 0, pushesSent: 0, rowsClosed: 0 };
  }

  const byAgent = new Map<string, PendingRow[]>();
  for (const r of rows) {
    const aid = String(r.agent_id);
    const list = byAgent.get(aid) ?? [];
    list.push(r);
    byAgent.set(aid, list);
  }

  let agentsProcessed = 0;
  let pushesSent = 0;
  let rowsClosed = 0;
  const now = new Date().toISOString();

  for (const [agentId, list] of byAgent) {
    agentsProcessed++;
    const prefs = await getAgentNotificationPreferences(agentId);
    const ids = list.map((x) => x.id);

    if (!prefs.push_reminder) {
      await updateManyInboxPushSentAt(ids, now);
      rowsClosed += ids.length;
      continue;
    }

    const userId = await getAuthUserIdForAgent(agentId);
    if (!userId) {
      await updateManyInboxPushSentAt(ids, now);
      rowsClosed += ids.length;
      continue;
    }

    const tokens = await listExpoPushTokensForUser(userId);
    if (!tokens.length) {
      await updateManyInboxPushSentAt(ids, now);
      rowsClosed += ids.length;
      continue;
    }

    const n = list.length;
    const title =
      n === 1 ? "Follow-up reminder — LeadSmart AI" : `${n} follow-up reminders — LeadSmart AI`;
    const firstBody = list[0]?.body?.trim() || "Time to reach out.";
    const body =
      n === 1
        ? firstBody.slice(0, 180)
        : `You have ${n} leads due for follow-up. Open the app to review.`;

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      priority: "default",
      data: {
        kind: "reminder_digest",
        screen: "notifications",
        reminderCount: String(n),
      },
    }));

    await sendExpoPushMessages(messages);
    pushesSent++;
    await updateManyInboxPushSentAt(ids, now);
    rowsClosed += ids.length;
  }

  return { agentsProcessed, pushesSent, rowsClosed };
}
