"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type SupportRealtimeRole = "customer" | "support";

const TYPING_EVENT = "typing";
const PEER_TYPING_TTL_MS = 3200;
const LOCAL_TYPING_IDLE_MS = 2200;

function supportChannelName(conversationPublicId: string) {
  return `support_thread:${conversationPublicId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function envConfigured() {
  return Boolean(
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
      typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  );
}

function presenceHasRole(state: RealtimePresenceState, target: SupportRealtimeRole): boolean {
  for (const entries of Object.values(state)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === "object" && "role" in entry) {
        if ((entry as { role?: string }).role === target) return true;
      }
    }
  }
  return false;
}

export type UseSupportRealtimeOptions = {
  conversationPublicId: string | null | undefined;
  role: SupportRealtimeRole;
  displayName?: string;
  enabled?: boolean;
};

export type UseSupportRealtimeResult = {
  customerPresent: boolean;
  supportPresent: boolean;
  peerPresent: boolean;
  peerTyping: boolean;
  typingLabel: string;
  peerPresenceLabel: string;
  isRealtimeReady: boolean;
  notifyComposerActivity: (active: boolean) => void;
  flushTypingStop: () => void;
};

/**
 * Supabase Realtime Presence + Broadcast for one support thread.
 * Typing is ephemeral (broadcast only). Keep HTTP polling for messages.
 */
export function useSupportRealtime(options: UseSupportRealtimeOptions): UseSupportRealtimeResult {
  const { conversationPublicId, role, displayName = "", enabled = true } = options;

  const [customerPresent, setCustomerPresent] = useState(false);
  const [supportPresent, setSupportPresent] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [channelStatus, setChannelStatus] = useState<"idle" | "subscribed" | "error">("idle");

  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const presenceKeyRef = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `p-${Math.random().toString(36).slice(2)}`
  );
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingActiveRef = useRef(false);
  const metaRef = useRef({ role, displayName });
  metaRef.current = { role, displayName };

  const peerRole: SupportRealtimeRole = role === "customer" ? "support" : "customer";

  const clearPeerTypingTimer = useCallback(() => {
    if (peerTypingTimerRef.current) {
      clearTimeout(peerTypingTimerRef.current);
      peerTypingTimerRef.current = null;
    }
  }, []);

  const schedulePeerTypingExpiry = useCallback(() => {
    clearPeerTypingTimer();
    peerTypingTimerRef.current = setTimeout(() => {
      setPeerTyping(false);
      peerTypingTimerRef.current = null;
    }, PEER_TYPING_TTL_MS);
  }, [clearPeerTypingTimer]);

  const broadcastTyping = useCallback(async (typing: boolean) => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) return;
    try {
      await ch.send({
        type: "broadcast",
        event: TYPING_EVENT,
        payload: { role: metaRef.current.role, typing },
      });
    } catch (e) {
      console.warn("[support-realtime] broadcast typing failed", e);
    }
  }, []);

  useEffect(() => {
    clearPeerTypingTimer();
    setPeerTyping(false);
    setCustomerPresent(false);
    setSupportPresent(false);
    subscribedRef.current = false;
    setChannelStatus("idle");
    channelRef.current = null;

    if (!enabled || !conversationPublicId?.trim() || !envConfigured()) {
      return;
    }

    const publicId = conversationPublicId.trim();
    const channel = supabase.channel(supportChannelName(publicId), {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKeyRef.current },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCustomerPresent(presenceHasRole(state, "customer"));
        setSupportPresent(presenceHasRole(state, "support"));
      })
      .on("broadcast", { event: TYPING_EVENT }, ({ payload }) => {
        const p = payload as { role?: SupportRealtimeRole; typing?: boolean };
        if (p.role !== peerRole) return;
        if (p.typing) {
          setPeerTyping(true);
          schedulePeerTypingExpiry();
        } else {
          clearPeerTypingTimer();
          setPeerTyping(false);
        }
      });

    channel.subscribe(async (status, err) => {
      if (status === "SUBSCRIBED") {
        subscribedRef.current = true;
        setChannelStatus("subscribed");
        try {
          await channel.track({
            role: metaRef.current.role,
            name: metaRef.current.displayName,
            online_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("[support-realtime] presence track failed", e);
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        subscribedRef.current = false;
        setChannelStatus("error");
        console.warn("[support-realtime] channel", status, err?.message ?? "");
      } else if (status === "CLOSED") {
        subscribedRef.current = false;
        setChannelStatus("idle");
      }
    });

    return () => {
      clearPeerTypingTimer();
      subscribedRef.current = false;
      channelRef.current = null;
      setChannelStatus("idle");
      void supabase.removeChannel(channel);
    };
  }, [conversationPublicId, enabled, supabase, clearPeerTypingTimer, schedulePeerTypingExpiry, peerRole]);

  const notifyComposerActivity = useCallback(
    (active: boolean) => {
      if (!subscribedRef.current) return;

      if (localTypingStopRef.current) {
        clearTimeout(localTypingStopRef.current);
        localTypingStopRef.current = null;
      }

      if (active) {
        if (!localTypingActiveRef.current) {
          localTypingActiveRef.current = true;
          void broadcastTyping(true);
        }
        localTypingStopRef.current = setTimeout(() => {
          localTypingActiveRef.current = false;
          void broadcastTyping(false);
          localTypingStopRef.current = null;
        }, LOCAL_TYPING_IDLE_MS);
      } else {
        if (localTypingActiveRef.current) {
          localTypingActiveRef.current = false;
          void broadcastTyping(false);
        }
      }
    },
    [broadcastTyping]
  );

  const flushTypingStop = useCallback(() => {
    if (localTypingStopRef.current) {
      clearTimeout(localTypingStopRef.current);
      localTypingStopRef.current = null;
    }
    localTypingActiveRef.current = false;
    void broadcastTyping(false);
  }, [broadcastTyping]);

  const peerPresent = role === "customer" ? supportPresent : customerPresent;

  const typingLabel = useMemo(() => {
    if (!peerTyping) return "";
    return peerRole === "support" ? "Support is typing…" : "Customer is typing…";
  }, [peerRole, peerTyping]);

  const peerPresenceLabel = useMemo(() => {
    if (!peerPresent) return "";
    return peerRole === "support" ? "Support is viewing this chat" : "Customer is viewing this chat";
  }, [peerPresent, peerRole]);

  return {
    customerPresent,
    supportPresent,
    peerPresent,
    peerTyping,
    typingLabel,
    peerPresenceLabel,
    isRealtimeReady: channelStatus === "subscribed",
    notifyComposerActivity,
    flushTypingStop,
  };
}

/** Typing line with motion; pass `typingLabel` from the hook. */
export function SupportRealtimeTypingRow({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      className="flex items-center gap-2 px-1 py-1 text-sm text-gray-500"
      aria-live="polite"
      role="status"
    >
      <span className="flex gap-0.5" aria-hidden>
        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
      </span>
      <span className="italic">{text}</span>
    </div>
  );
}

/** Presence pill; pass `peerPresenceLabel` from the hook. */
export function SupportRealtimePresencePill({ text }: { text: string }) {
  if (!text) return null;
  return (
    <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {text}
    </span>
  );
}
