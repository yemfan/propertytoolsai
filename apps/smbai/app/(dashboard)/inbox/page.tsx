import { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "@/components/inbox-client";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  // Load all messages for this org
  const { data: rawMessages } = await supabase
    .from("messages")
    .select(`
      id, channel, direction, subject, body, sent_at, read, client_id,
      clients(id, first_name, last_name, email, phone)
    `)
    .eq("organization_id", orgId)
    .order("sent_at", { ascending: true });

  // Load all clients (for compose)
  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .eq("organization_id", orgId)
    .order("last_name");

  // Group messages into threads by client_id
  type RawMsg = NonNullable<typeof rawMessages>[number];
  type MsgForThread = {
    id: string;
    channel: "email" | "sms";
    direction: "inbound" | "outbound";
    subject: string | null;
    body: string;
    sent_at: string;
    read: boolean;
  };
  type Thread = {
    clientId: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    lastMessage: MsgForThread;
    unreadCount: number;
    messages: MsgForThread[];
  };

  const threadMap = new Map<string, Thread>();

  for (const msg of rawMessages ?? []) {
    const clientId = msg.client_id ?? "unknown";
    const clientsRaw = msg.clients;
    const clientRaw = (Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw) as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    const clientName = clientRaw
      ? [clientRaw.first_name, clientRaw.last_name].filter(Boolean).join(" ") || "Unknown"
      : "Unknown";

    const m: MsgForThread = {
      id: msg.id,
      channel: msg.channel as "email" | "sms",
      direction: msg.direction as "inbound" | "outbound",
      subject: msg.subject,
      body: msg.body,
      sent_at: msg.sent_at,
      read: msg.read,
    };

    const existing = threadMap.get(clientId);
    if (existing) {
      existing.messages.push(m);
      existing.lastMessage = m;
      if (!m.read && m.direction === "inbound") existing.unreadCount++;
    } else {
      threadMap.set(clientId, {
        clientId,
        clientName,
        clientEmail: clientRaw?.email ?? null,
        clientPhone: clientRaw?.phone ?? null,
        lastMessage: m,
        unreadCount: !m.read && m.direction === "inbound" ? 1 : 0,
        messages: [m],
      });
    }
  }

  // Sort threads: most recent first
  const threads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
  );

  return (
    <InboxClient
      threads={threads}
      clients={(clients ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }[]}
    />
  );
}
