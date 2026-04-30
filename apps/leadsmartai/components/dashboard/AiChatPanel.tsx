"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const QUICK_PROMPTS = [
  "Who should I follow up with today?",
  "Which leads are going cold?",
  "Summarize my pipeline",
  "What are my priorities this week?",
];

export function AiChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/dashboard/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: messages,
          }),
        });
        const body = await res.json();
        const reply = body.ok
          ? body.reply
          : body.error || "Sorry, something went wrong.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Network error. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  // Floating button — uses the LeadSmart AI mascot so the assistant
  // has a recognizable face in the corner before it's opened.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-blue-100 transition-transform hover:scale-105 hover:ring-blue-200"
        aria-label="Open LeadSmart AI Assistant"
      >
        <img
          src="/ai-assistant-mascot.png"
          alt=""
          aria-hidden
          className="h-14 w-14 object-contain"
        />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[560px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 ring-1 ring-white/40">
            <img
              src="/ai-assistant-mascot.png"
              alt=""
              aria-hidden
              className="h-8 w-8 object-contain"
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">LeadSmart AI Assistant</p>
            <p className="text-[11px] opacity-80 truncate">Ask about your leads, tasks, pipeline</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-white/80 hover:text-white text-xl leading-none shrink-0"
          aria-label="Close LeadSmart AI Assistant"
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[380px]">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Try asking:</p>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full text-left text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 hover:bg-blue-100 transition"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-blue-50 text-blue-900 rounded-xl rounded-br-sm px-3 py-2 ml-8"
                : "bg-gray-50 text-gray-800 rounded-xl rounded-bl-sm px-3 py-2 mr-8"
            }`}
          >
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}

        {loading && (
          <div className="bg-gray-50 rounded-xl rounded-bl-sm px-3 py-2 mr-8">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-3 py-3 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask LeadSmart AI..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
