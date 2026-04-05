"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  fetchConversation,
  markConversationRead,
  sendSupportMessage,
  startSupportConversation,
  type SupportConversationDetail,
} from "@/lib/support-chat/api";
import { usePolling } from "@/lib/support-chat/polling";
import type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function AgentAvatar({ agent, size = 40 }: { agent: AssignedAgentPayload; size?: number }) {
  const initials = agent.displayName.slice(0, 1).toUpperCase();
  return agent.avatarUrl ? (
    <Image
      src={agent.avatarUrl}
      alt={agent.displayName}
      width={size}
      height={size}
      unoptimized
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-[#0072ce] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export default function AgentChatWidget({ customerUserId }: { customerUserId: string | null }) {
  const [agent, setAgent] = useState<AssignedAgentPayload | null>(null);
  const [open, setOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [conversationPublicId, setConversationPublicId] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load agent
  useEffect(() => {
    void fetch("/api/consumer/assigned-agent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; agent?: AssignedAgentPayload | null } | null) => {
        if (data?.ok) setAgent(data.agent ?? null);
      })
      .catch(() => {});
  }, []);

  // Pre-fill name/email for logged-in users
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.full_name === "string" && data.full_name.trim())
          setCustomerName(data.full_name.trim());
        if (typeof data.email === "string" && data.email.includes("@"))
          setCustomerEmail(data.email.trim().toLowerCase());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setConversationPublicId("");
      setMessageInput("");
      setStarting(false);
      setSending(false);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { data, isLoading, error, reload } = usePolling<{
    success: true;
    conversation: SupportConversationDetail | null;
  }>({
    enabled: Boolean(conversationPublicId) && open,
    intervalMs: 4000,
    fetcher: () => fetchConversation(conversationPublicId),
  });

  const conversation = data?.conversation ?? null;

  useEffect(() => {
    if (!conversationPublicId || !conversation?.messages?.length) return;
    void markConversationRead({ conversationPublicId, readerType: "customer" });
  }, [conversationPublicId, conversation?.messages?.length]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [conversation?.messages?.length]);

  if (!agent) return null;

  const canStart =
    customerName.trim().length >= 2 &&
    /.+@.+\..+/.test(customerEmail.trim()) &&
    messageInput.trim().length > 0;

  async function handleStart() {
    if (!canStart || starting || !agent) return;
    setStarting(true);
    try {
      const result = await startSupportConversation({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        subject: `Message for ${agent.displayName}`,
        initialMessage: messageInput.trim(),
        source: "propertytools_assigned_agent",
        customerUserId,
        assignedAgentAuthUserId: agent.authUserId,
        assignedAgentName: agent.displayName,
        notifyAgentSms: true,
      });
      setConversationPublicId(result.conversation.publicId);
      setMessageInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  }

  async function handleSend() {
    if (!conversationPublicId || !messageInput.trim() || sending) return;
    setSending(true);
    try {
      await sendSupportMessage({
        conversationPublicId,
        senderType: "customer",
        senderName: customerName.trim() || undefined,
        senderEmail: customerEmail.trim().toLowerCase() || undefined,
        body: messageInput.trim(),
      });
      setMessageInput("");
      await reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="flex w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[380px]"
          style={{ maxHeight: "min(560px, 85vh)" }}>

          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
            <AgentAvatar agent={agent} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                Chat with {agent.displayName}
              </p>
              <p className="text-[11px] text-slate-400">Your agent · replies via SMS</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close chat"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Name / email fields (only before conversation starts) */}
          {!conversationPublicId && (
            <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <input
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0072ce]/60"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                type="email"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0072ce]/60"
                placeholder="Your email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          )}

          {/* Messages */}
          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            {!conversationPublicId && (
              <p className="text-sm text-slate-500">
                Send a message and {agent.displayName} will be notified right away.
              </p>
            )}
            {conversation?.messages?.map((message) => {
              const isCustomer = message.senderType === "customer";
              const isInternal = !!message.isInternalNote;
              return (
                <div key={message.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    <div className={[
                      "rounded-2xl px-3 py-2 text-sm shadow-sm",
                      isInternal
                        ? "border border-dashed bg-amber-50 text-amber-900"
                        : isCustomer
                          ? "bg-[#0072ce] text-white"
                          : "border border-slate-200 bg-white text-slate-900",
                    ].join(" ")}>
                      {message.body}
                    </div>
                    <div className={`mt-1 px-1 text-[11px] text-slate-400 ${isCustomer ? "text-right" : "text-left"}`}>
                      {message.senderName || message.senderType} · {formatTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && conversationPublicId ? (
              <div className="text-xs text-slate-400">Refreshing…</div>
            ) : null}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="min-h-[60px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0072ce]/60"
                placeholder={conversationPublicId ? "Write a message…" : "Type your first message…"}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (conversationPublicId) void handleSend();
                    else void handleStart();
                  }
                }}
              />
              <button
                type="button"
                disabled={conversationPublicId ? (!messageInput.trim() || sending) : (!canStart || starting)}
                onClick={() => conversationPublicId ? void handleSend() : void handleStart()}
                className="shrink-0 self-end rounded-xl bg-[#0072ce] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0062b5] disabled:opacity-40"
              >
                {(starting || sending) ? "…" : conversationPublicId ? "Send" : "Start"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white py-2 pl-2 pr-4 shadow-lg transition hover:shadow-xl"
        aria-label={open ? "Close chat" : `Chat with ${agent.displayName}`}
      >
        <AgentAvatar agent={agent} size={36} />
        {!open && (
          <span className="text-sm font-semibold text-slate-800">
            Chat with {agent.displayName}
          </span>
        )}
        {open && (
          <span className="text-sm font-semibold text-slate-500">Close</span>
        )}
      </button>
    </div>
  );
}
