"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Building2, DollarSign, Mic, Cog } from "lucide-react";

type TabKey = "general" | "financial" | "voice" | "operations";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "financial", label: "Financial", icon: DollarSign },
  { key: "voice", label: "Voice AI", icon: Mic },
  { key: "operations", label: "Operations", icon: Cog },
];

/**
 * Tabbed Settings shell. Each tab's content is server-rendered in the page and
 * passed in as a slot, so this stays a thin client component just for tab state.
 */
export function SettingsTabs({
  general,
  financial,
  voice,
  operations,
}: {
  general: ReactNode;
  financial: ReactNode;
  voice: ReactNode;
  operations: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("general");

  // Deep-link: /settings#voice-agent (e.g. the Voice page's Settings link) opens
  // the Voice AI tab directly.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#voice-agent") {
      setTab("voice");
    }
  }, []);

  const slots: Record<TabKey, ReactNode> = { general, financial, voice, operations };

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 mb-8 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-8">{slots[tab]}</div>
    </div>
  );
}
