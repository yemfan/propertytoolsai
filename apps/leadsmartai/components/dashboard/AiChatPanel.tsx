"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GuideMessage = { role: "user" | "assistant"; content: string };

type ThreadMessage = {
  id: string;
  message: string;
  direction: "inbound" | "outbound";
  created_at: string;
};

type ContactOption = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type ContactTab = {
  /** Tab identity, not contact identity — survives the contact pick. */
  tabId: string;
  contact: ContactOption | null;
  prompt: string;
  draft: string;
  drafting: boolean;
  sending: boolean;
  autoPilot: boolean;
  thread: ThreadMessage[];
  threadLoading: boolean;
  message: string | null;
};

type Tab = { kind: "guide" } | { kind: "contact"; tab: ContactTab };

const QUICK_PROMPTS = [
  "Who should I follow up with today?",
  "Which leads are going cold?",
  "Summarize my pipeline",
  "What are my priorities this week?",
];

function newContactTab(): ContactTab {
  return {
    tabId: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    contact: null,
    prompt: "",
    draft: "",
    drafting: false,
    sending: false,
    autoPilot: false,
    thread: [],
    threadLoading: false,
    message: null,
  };
}

function contactLabel(c: ContactOption | null): string {
  if (!c) return "New contact tab";
  return c.name?.trim() || c.email?.trim() || c.phone?.trim() || "Contact";
}

// localStorage key for the panel's last position. Bumped if the
// panel size changes meaningfully so a stale offscreen position
// doesn't survive a redesign.
const PANEL_POSITION_STORAGE_KEY = "leadsmart.ai-panel.position.v1";
const PANEL_WIDTH = 440;
const PANEL_MAX_HEIGHT = 640;

type PanelPosition = { x: number; y: number };

function clampToViewport(p: PanelPosition): PanelPosition {
  if (typeof window === "undefined") return p;
  const maxX = Math.max(0, window.innerWidth - PANEL_WIDTH);
  // Use the panel's likely visible height (capped at PANEL_MAX_HEIGHT)
  // rather than its full max — keeps the drag handle reachable even if
  // a later viewport resize would have stranded it.
  const maxY = Math.max(0, window.innerHeight - 120);
  return {
    x: Math.min(maxX, Math.max(0, p.x)),
    y: Math.min(maxY, Math.max(0, p.y)),
  };
}

export function AiChatPanel() {
  const [open, setOpen] = useState(false);

  const [activeTabId, setActiveTabId] = useState<string>("guide");
  const [contactTabs, setContactTabs] = useState<ContactTab[]>([]);

  // Drag/reposition state. `null` = use the default bottom-right
  // anchor (Tailwind classes); a value = explicit top/left positioning.
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [dragging, setDragging] = useState(false);

  // Hydrate saved position once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PanelPosition;
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setPosition(clampToViewport(parsed));
      }
    } catch {
      // ignore stale / malformed values
    }
  }, []);

  // Persist + re-clamp on viewport resize so the panel never strands
  // off-screen if the user shrinks the window.
  useEffect(() => {
    if (!position) return;
    try {
      window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(position));
    } catch {
      // private mode / quota — non-fatal
    }
  }, [position]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onResize() {
      setPosition((cur) => (cur ? clampToViewport(cur) : cur));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Drag handlers — attached to the header. Skips if the user clicked
  // an interactive control (the close button) so X still closes.
  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const headerEl = e.currentTarget;
    const panelEl = headerEl.parentElement as HTMLElement | null;
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragging(true);
    headerEl.setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      setPosition(clampToViewport({ x: ev.clientX - offsetX, y: ev.clientY - offsetY }));
    };
    const onUp = (ev: PointerEvent) => {
      setDragging(false);
      headerEl.releasePointerCapture?.(ev.pointerId);
      headerEl.removeEventListener("pointermove", onMove);
      headerEl.removeEventListener("pointerup", onUp);
      headerEl.removeEventListener("pointercancel", onUp);
    };
    headerEl.addEventListener("pointermove", onMove);
    headerEl.addEventListener("pointerup", onUp);
    headerEl.addEventListener("pointercancel", onUp);
  }, []);

  const resetPosition = useCallback(() => {
    setPosition(null);
    try {
      window.localStorage.removeItem(PANEL_POSITION_STORAGE_KEY);
    } catch {
      // non-fatal
    }
  }, []);

  // ── AI Guide (free-form chat) state ─────────────────────────────
  const [guideMessages, setGuideMessages] = useState<GuideMessage[]>([]);
  const [guideInput, setGuideInput] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const guideScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && activeTabId === "guide" && guideScrollRef.current) {
      guideScrollRef.current.scrollTop = guideScrollRef.current.scrollHeight;
    }
  }, [guideMessages, open, activeTabId]);

  const sendGuide = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || guideLoading) return;
      const userMsg: GuideMessage = { role: "user", content: trimmed };
      setGuideMessages((prev) => [...prev, userMsg]);
      setGuideInput("");
      setGuideLoading(true);
      try {
        const res = await fetch("/api/dashboard/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history: guideMessages }),
        });
        const body = await res.json();
        const reply = body.ok ? body.reply : body.error || "Sorry, something went wrong.";
        setGuideMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch {
        setGuideMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Network error. Please try again." },
        ]);
      } finally {
        setGuideLoading(false);
      }
    },
    [guideMessages, guideLoading],
  );

  // ── Contact tab helpers ─────────────────────────────────────────
  const updateTab = useCallback((tabId: string, patch: Partial<ContactTab>) => {
    setContactTabs((prev) => prev.map((t) => (t.tabId === tabId ? { ...t, ...patch } : t)));
  }, []);

  const openNewContactTab = useCallback(() => {
    const t = newContactTab();
    setContactTabs((prev) => [...prev, t]);
    setActiveTabId(t.tabId);
  }, []);

  const closeContactTab = useCallback(
    (tabId: string) => {
      setContactTabs((prev) => prev.filter((t) => t.tabId !== tabId));
      setActiveTabId((cur) => (cur === tabId ? "guide" : cur));
    },
    [],
  );

  const loadThread = useCallback(
    async (tabId: string, contactId: string) => {
      updateTab(tabId, { threadLoading: true });
      try {
        const res = await fetch(
          `/api/dashboard/sms/messages?contactId=${encodeURIComponent(contactId)}`,
        );
        const body = await res.json();
        if (body.ok) {
          updateTab(tabId, {
            thread: body.messages ?? [],
            autoPilot: Boolean(body.autoPilot),
            threadLoading: false,
          });
        } else {
          updateTab(tabId, { threadLoading: false, message: body.error ?? "Could not load thread." });
        }
      } catch {
        updateTab(tabId, { threadLoading: false, message: "Network error loading thread." });
      }
    },
    [updateTab],
  );

  const onPickContact = useCallback(
    async (tabId: string, contact: ContactOption) => {
      updateTab(tabId, { contact, draft: "", message: null });
      await loadThread(tabId, contact.id);
    },
    [loadThread, updateTab],
  );

  const generateDraft = useCallback(
    async (tab: ContactTab) => {
      if (!tab.contact || !tab.prompt.trim()) return;
      updateTab(tab.tabId, { drafting: true, message: null });
      try {
        const res = await fetch("/api/dashboard/sms/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: tab.contact.id, prompt: tab.prompt.trim() }),
        });
        const body = await res.json();
        if (!body.ok) throw new Error(body.error ?? "Failed");
        updateTab(tab.tabId, { draft: String(body.draft ?? ""), drafting: false });
      } catch (e) {
        updateTab(tab.tabId, {
          drafting: false,
          message: e instanceof Error ? e.message : "Draft failed.",
        });
      }
    },
    [updateTab],
  );

  const sendDraft = useCallback(
    async (tab: ContactTab) => {
      if (!tab.contact || !tab.draft.trim() || !tab.contact.phone) return;
      updateTab(tab.tabId, { sending: true, message: null });
      try {
        const res = await fetch("/api/ai-sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: tab.contact.id,
            to: tab.contact.phone,
            body: tab.draft.trim(),
          }),
        });
        const body = await res.json();
        if (!body.success) throw new Error(body.error ?? "Send failed");
        updateTab(tab.tabId, { sending: false, draft: "", prompt: "", message: "Sent." });
        // Refresh thread to pick up the new outbound row.
        await loadThread(tab.tabId, tab.contact.id);
      } catch (e) {
        updateTab(tab.tabId, {
          sending: false,
          message: e instanceof Error ? e.message : "Send failed.",
        });
      }
    },
    [loadThread, updateTab],
  );

  const toggleAutoPilot = useCallback(
    async (tab: ContactTab, next: boolean) => {
      if (!tab.contact) return;
      // Optimistic flip; revert on error.
      updateTab(tab.tabId, { autoPilot: next, message: null });
      try {
        const res = await fetch("/api/dashboard/sms/auto-pilot", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: tab.contact.id, enabled: next }),
        });
        const body = await res.json();
        if (!body.ok) throw new Error(body.error ?? "Toggle failed");
      } catch (e) {
        updateTab(tab.tabId, {
          autoPilot: !next,
          message: e instanceof Error ? e.message : "Toggle failed.",
        });
      }
    },
    [updateTab],
  );

  // After draft generation, if Auto Pilot is on, send immediately.
  // Effect approach so the latest draft is in state before the send fires.
  const lastAutoSentRef = useRef<string>("");
  useEffect(() => {
    if (!open) return;
    for (const t of contactTabs) {
      if (
        t.autoPilot &&
        t.draft.trim() &&
        !t.drafting &&
        !t.sending &&
        t.contact?.phone &&
        lastAutoSentRef.current !== `${t.tabId}:${t.draft}`
      ) {
        lastAutoSentRef.current = `${t.tabId}:${t.draft}`;
        void sendDraft(t);
      }
    }
  }, [contactTabs, open, sendDraft]);

  // ── Floating button (closed state) ──────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-blue-100 transition-transform hover:scale-105 hover:ring-blue-200"
        aria-label="Open LeadSmart AI"
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

  const activeContactTab = contactTabs.find((t) => t.tabId === activeTabId) ?? null;

  // When the user has dragged, switch from Tailwind bottom/right anchor
  // to explicit top/left so it stays where they left it.
  const positionedClass = position ? "" : "bottom-6 right-6";
  const positionedStyle: React.CSSProperties | undefined = position
    ? { top: position.y, left: position.x, bottom: "auto", right: "auto" }
    : undefined;

  return (
    <div
      className={`fixed z-50 flex max-h-[640px] w-[440px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ${positionedClass} ${dragging ? "select-none" : ""}`}
      style={positionedStyle}
    >
      {/* Header — also the drag handle. */}
      <div
        onPointerDown={onHeaderPointerDown}
        onDoubleClick={resetPosition}
        title="Drag to reposition · Double-click to reset"
        className={`flex items-center justify-between gap-3 bg-blue-600 px-4 py-3 text-white touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 ring-1 ring-white/40">
            <img src="/ai-assistant-mascot.png" alt="" aria-hidden className="h-8 w-8 object-contain" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">LeadSmart AI</p>
            <p className="truncate text-[11px] opacity-80">Guide + per-contact SMS drafting</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 text-xl leading-none text-white/80 hover:text-white"
          aria-label="Close LeadSmart AI"
        >
          &times;
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 px-2 py-1">
        <TabPill
          label="AI Guide"
          active={activeTabId === "guide"}
          onClick={() => setActiveTabId("guide")}
        />
        {contactTabs.map((t) => (
          <TabPill
            key={t.tabId}
            label={contactLabel(t.contact)}
            active={activeTabId === t.tabId}
            onClick={() => setActiveTabId(t.tabId)}
            onClose={() => closeContactTab(t.tabId)}
            tone={t.autoPilot ? "autopilot" : undefined}
          />
        ))}
        <button
          type="button"
          onClick={openNewContactTab}
          className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-blue-50 hover:text-blue-600"
          aria-label="New contact tab"
          title="New contact tab"
        >
          +
        </button>
      </div>

      {/* Body */}
      {activeTabId === "guide" ? (
        <GuideTabBody
          messages={guideMessages}
          loading={guideLoading}
          input={guideInput}
          setInput={setGuideInput}
          send={sendGuide}
          scrollRef={guideScrollRef}
          quickPrompts={QUICK_PROMPTS}
        />
      ) : activeContactTab ? (
        <ContactTabBody
          tab={activeContactTab}
          updateTab={updateTab}
          generateDraft={generateDraft}
          sendDraft={sendDraft}
          toggleAutoPilot={toggleAutoPilot}
          onPickContact={onPickContact}
        />
      ) : (
        <div className="flex-1 p-4 text-sm text-gray-500">Tab not found.</div>
      )}
    </div>
  );
}

// ── Tab pill ──────────────────────────────────────────────────────
function TabPill({
  label,
  active,
  onClick,
  onClose,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
  tone?: "autopilot";
}) {
  return (
    <div
      className={`group inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active
          ? tone === "autopilot"
            ? "bg-amber-500 text-white"
            : "bg-blue-600 text-white"
          : tone === "autopilot"
            ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
            : "bg-white text-gray-700 hover:bg-gray-100"
      }`}
    >
      <button type="button" onClick={onClick} className="max-w-[140px] truncate">
        {tone === "autopilot" ? "🛫 " : ""}
        {label}
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={`ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none ${
            active ? "text-white/80 hover:bg-white/20" : "text-gray-400 hover:bg-gray-200"
          }`}
          aria-label="Close tab"
          title="Close tab"
        >
          &times;
        </button>
      ) : null}
    </div>
  );
}

// ── Guide tab body ────────────────────────────────────────────────
function GuideTabBody({
  messages,
  loading,
  input,
  setInput,
  send,
  scrollRef,
  quickPrompts,
}: {
  messages: GuideMessage[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  send: (text: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  quickPrompts: string[];
}) {
  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 min-h-[220px] max-h-[420px]">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Try asking:</p>
            {quickPrompts.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-sm text-blue-600 transition hover:bg-blue-100"
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
                ? "ml-8 rounded-xl rounded-br-sm bg-blue-50 px-3 py-2 text-blue-900"
                : "mr-8 rounded-xl rounded-bl-sm bg-gray-50 px-3 py-2 text-gray-800"
            }`}
          >
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="mr-8 rounded-xl rounded-bl-sm bg-gray-50 px-3 py-2">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-gray-100 px-3 py-3">
        <input
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
    </>
  );
}

// ── Contact tab body ──────────────────────────────────────────────
function ContactTabBody({
  tab,
  updateTab,
  generateDraft,
  sendDraft,
  toggleAutoPilot,
  onPickContact,
}: {
  tab: ContactTab;
  updateTab: (tabId: string, patch: Partial<ContactTab>) => void;
  generateDraft: (tab: ContactTab) => void;
  sendDraft: (tab: ContactTab) => void;
  toggleAutoPilot: (tab: ContactTab, next: boolean) => void;
  onPickContact: (tabId: string, contact: ContactOption) => void;
}) {
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [tab.thread]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Top: contact picker + auto-pilot toggle */}
      <div className="space-y-2 border-b border-gray-100 px-3 py-3">
        {tab.contact ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {contactLabel(tab.contact)}
              </p>
              <p className="truncate text-[11px] text-gray-500">
                {tab.contact.phone || "(no phone)"}
                {tab.contact.email ? ` · ${tab.contact.email}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AutoPilotSwitch
                checked={tab.autoPilot}
                onChange={(v) => toggleAutoPilot(tab, v)}
              />
              <button
                type="button"
                onClick={() => updateTab(tab.tabId, { contact: null, draft: "", thread: [] })}
                className="text-xs text-gray-400 hover:text-gray-700"
                title="Pick a different contact"
              >
                change
              </button>
            </div>
          </div>
        ) : (
          <ContactPicker onPick={(c) => onPickContact(tab.tabId, c)} />
        )}
      </div>

      {/* Middle: prompt + draft + thread */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 min-h-[220px] max-h-[360px]">
        {tab.contact ? (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                What do you want to say?
              </label>
              <textarea
                value={tab.prompt}
                onChange={(e) => updateTab(tab.tabId, { prompt: e.target.value })}
                rows={2}
                placeholder='e.g. "Confirm tomorrow at 3pm" or "Ask about their financing"'
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => generateDraft(tab)}
                disabled={tab.drafting || !tab.prompt.trim()}
                className="mt-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {tab.drafting ? "Drafting..." : "Generate draft"}
              </button>
            </div>

            {tab.draft ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Draft (editable)
                </label>
                <textarea
                  value={tab.draft}
                  onChange={(e) => updateTab(tab.tabId, { draft: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
                {!tab.autoPilot ? (
                  <button
                    type="button"
                    onClick={() => sendDraft(tab)}
                    disabled={tab.sending}
                    className="mt-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {tab.sending ? "Sending..." : "Send SMS"}
                  </button>
                ) : (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {tab.sending ? "Auto Pilot sending…" : "Auto Pilot will send this draft."}
                  </p>
                )}
              </div>
            ) : null}

            {tab.message ? (
              <p className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-800">{tab.message}</p>
            ) : null}

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                SMS thread {tab.threadLoading ? "(loading…)" : ""}
              </label>
              <div ref={threadRef} className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2 max-h-44 overflow-y-auto">
                {tab.thread.length === 0 && !tab.threadLoading && (
                  <p className="px-1 py-2 text-center text-[11px] text-gray-400">
                    No messages yet.
                  </p>
                )}
                {tab.thread.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                      m.direction === "outbound"
                        ? "ml-auto bg-blue-600 text-white"
                        : "mr-auto bg-white text-gray-800 ring-1 ring-gray-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="px-2 py-6 text-center text-xs text-gray-400">
            Pick a contact above to start drafting an SMS.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Contact picker (typeahead) ────────────────────────────────────
function ContactPicker({ onPick }: { onPick: (c: ContactOption) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/contacts/search?q=${encodeURIComponent(q.trim())}`);
        const body = await res.json();
        setResults(Array.isArray(body?.contacts) ? body.contacts : Array.isArray(body?.results) ? body.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search a contact by name, email, phone…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />
      {open && q.trim() ? (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No contacts match.</div>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
                setQ("");
              }}
              className="block w-full border-b border-gray-50 px-3 py-2 text-left text-sm hover:bg-blue-50 last:border-b-0"
            >
              <div className="truncate font-medium text-gray-900">{contactLabel(c)}</div>
              <div className="truncate text-[11px] text-gray-500">
                {c.phone || c.email || c.id}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Auto Pilot switch (small, accessible) ─────────────────────────
function AutoPilotSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
        checked ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-700"
      }`}
      title="Auto Pilot — auto-send drafts and auto-reply to inbound SMS for this contact."
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span aria-hidden>{checked ? "🛫" : "✈️"}</span>
      <span>Auto Pilot</span>
    </label>
  );
}
