/**
 * Browser helpers for `/api/support-chat/*` (same-origin `fetch`).
 */

export type SupportStatus =
  | "open"
  | "waiting_on_support"
  | "waiting_on_customer"
  | "resolved"
  | "closed";

export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SenderType = "customer" | "support" | "system" | "ai";

export type SupportMessage = {
  id: string;
  senderType: SenderType;
  senderName?: string;
  senderEmail?: string;
  body: string;
  createdAt: string;
  isInternalNote?: boolean;
};

export type SupportConversationSummary = {
  id: string;
  publicId: string;
  customerName: string;
  customerEmail: string;
  subject?: string;
  status: SupportStatus;
  priority: SupportPriority;
  assignedAgentName?: string;
  unreadForSupport: number;
  unreadForCustomer: number;
  lastMessageAt?: string;
};

export type SupportConversationDetail = SupportConversationSummary & {
  messages: SupportMessage[];
};

async function parseResponse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || "Request failed");
  }
  return data as T;
}

export async function fetchConversationList(params?: { status?: string }) {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const res = await fetch(
    `/api/support-chat/list${query.toString() ? `?${query.toString()}` : ""}`,
    { method: "GET", cache: "no-store" }
  );

  return parseResponse<{ success: true; conversations: SupportConversationSummary[] }>(res);
}

export async function fetchConversation(conversationPublicId: string) {
  const res = await fetch(
    `/api/support-chat/conversation?conversationPublicId=${encodeURIComponent(conversationPublicId)}`,
    { method: "GET", cache: "no-store" }
  );

  return parseResponse<{ success: true; conversation: SupportConversationDetail | null }>(res);
}

export async function sendSupportMessage(input: {
  conversationPublicId: string;
  senderType: SenderType;
  senderName?: string;
  senderEmail?: string;
  body: string;
  isInternalNote?: boolean;
}) {
  const res = await fetch("/api/support-chat/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<{ success: true; message: SupportMessage }>(res);
}

export async function markConversationRead(input: {
  conversationPublicId: string;
  readerType: "customer" | "support";
}) {
  const res = await fetch("/api/support-chat/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<{ success: true }>(res);
}

export async function updateConversationMeta(input: {
  conversationPublicId: string;
  status?: SupportStatus;
  priority?: SupportPriority;
  assignedAgentId?: string;
  assignedAgentName?: string;
}) {
  const res = await fetch("/api/support-chat/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<{ success: true }>(res);
}

export async function startSupportConversation(input: {
  customerName: string;
  customerEmail: string;
  subject?: string;
  initialMessage: string;
  source?: string;
}) {
  const res = await fetch("/api/support-chat/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<{ success: true; conversation: SupportConversationDetail }>(res);
}
