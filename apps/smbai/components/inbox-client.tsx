"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { MessageSquarePlus, Send, Mail, MessageSquare, RefreshCw } from "lucide-react";
import { markThreadRead, sendEmail, sendSms } from "@/lib/actions/messages";
import { InboxCompose } from "./inbox-compose";

type Channel = "all" | "email" | "sms";

interface Message {
  id: string;
  channel: "email" | "sms";
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string;
  sent_at: string;
  read: boolean;
}

interface Thread {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
}

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface Props {
  threads: Thread[];
  clients: Client[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function InboxClient({ threads: initialThreads, clients }: Props) {
  const [threads, setThreads] = useState(initialThreads);
  const [channel, setChannel] = useState<Channel>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreads[0]?.clientId ?? null
  );
  const [composing, setComposing] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when thread changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId]);

  const filtered = threads.filter(
    (t) => channel === "all" || t.lastMessage.channel === channel
  );
  const selected = threads.find((t) => t.clientId === selectedId);
  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);

  function selectThread(id: string) {
    setSelectedId(id);
    // Mark read optimistically
    setThreads((prev) =>
      prev.map((t) => (t.clientId === id ? { ...t, unreadCount: 0 } : t))
    );
    startTransition(() => markThreadRead(id));
  }

  function sendReply() {
    if (!selected || !replyBody.trim()) return;
    const body = replyBody.trim();
    setReplyBody("");

    startTransition(async () => {
      if (selected.lastMessage.channel === "email" && selected.clientEmail) {
        await sendEmail(selected.clientId, selected.clientEmail, "Re: " + (selected.lastMessage.subject ?? ""), body);
      } else if (selected.clientPhone) {
        await sendSms(selected.clientId, selected.clientPhone, body);
      }
      // Optimistically append the message
      const newMsg: Message = {
        id: crypto.randomUUID(),
        channel: selected.lastMessage.channel,
        direction: "outbound",
        subject: null,
        body,
        sent_at: new Date().toISOString(),
        read: true,
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.clientId === selected.clientId
            ? { ...t, lastMessage: newMsg, messages: [...t.messages, newMsg] }
            : t
        )
      );
    });
  }

  return (
    <>
      {composing && (
        <InboxCompose
          clients={clients}
          onClose={() => setComposing(false)}
          onSent={() => {
            // Simple: reload after send to pick up new thread
            window.location.reload();
          }}
        />
      )}

      <div className="flex h-full">
        {/* ── Thread list ── */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-800">Inbox</h1>
              {totalUnread > 0 && (
                <span className="text-xs font-semibold bg-indigo-600 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => setComposing(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="New conversation"
            >
              <MessageSquarePlus className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Channel filter */}
          <div className="px-3 py-2 border-b border-slate-100 flex gap-1">
            {(["all", "sms", "email"] as Channel[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setChannel(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  channel === tab
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {tab === "all" ? "All" : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Thread rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 mt-8">
                <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500 mb-1">No messages yet</p>
                <p className="text-xs text-slate-400">
                  Client SMS and emails will appear here.
                </p>
              </div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.clientId}
                  onClick={() => selectThread(t.clientId)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    selectedId === t.clientId ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-indigo-600">
                      {(t.clientName[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm ${t.unreadCount > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                          {t.clientName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {t.unreadCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          )}
                          <span className="text-xs text-slate-400">{timeAgo(t.lastMessage.sent_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {t.lastMessage.channel === "sms"
                          ? <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          : <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        }
                        <p className="text-xs text-slate-500 truncate">
                          {t.lastMessage.direction === "outbound" ? "You: " : ""}
                          {t.lastMessage.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Thread view ── */}
        {selected ? (
          <div className="flex-1 flex flex-col bg-slate-50">
            {/* Thread header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">{selected.clientName}</h2>
                <p className="text-xs text-slate-400">
                  {selected.lastMessage.channel === "email" ? selected.clientEmail : selected.clientPhone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selected.lastMessage.channel === "email"
                  ? <Mail className="w-4 h-4 text-slate-400" />
                  : <MessageSquare className="w-4 h-4 text-slate-400" />
                }
                <span className="text-xs text-slate-400 capitalize">{selected.lastMessage.channel}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selected.messages.map((msg) => {
                const isOut = msg.direction === "outbound";
                return (
                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-sm rounded-2xl px-4 py-2.5 ${
                      isOut
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                    }`}>
                      {msg.subject && !isOut && (
                        <p className="text-xs font-semibold mb-1 text-slate-500">{msg.subject}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <p className={`text-xs mt-1 ${isOut ? "text-indigo-200" : "text-slate-400"}`}>
                        {timeAgo(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="px-6 py-4 bg-white border-t border-slate-200">
              <div className="flex items-end gap-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                  }}
                  rows={2}
                  placeholder={`Reply via ${selected.lastMessage.channel}… (⌘↵ to send)`}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={isPending || !replyBody.trim()}
                  className="flex-shrink-0 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50 p-8">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
              <MessageSquarePlus className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">Select a conversation</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Reply to client SMS and emails from one unified inbox.
            </p>
            <button
              onClick={() => setComposing(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              New message
            </button>
          </div>
        )}
      </div>
    </>
  );
}
