"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings as SettingsIcon, ChevronDown, ChevronUp } from "lucide-react";
import MissedCallActivityLog from "@/components/dashboard/MissedCallActivityLog";
import MissedCallSettingsForm from "@/components/dashboard/MissedCallSettingsForm";
import OutboundCallPanel from "@/components/dashboard/OutboundCallPanel";

/**
 * /dashboard/missed-call — the AI Assistant voice console.
 *
 * Two tabs (mirrors HelmSmart):
 *   - Inbound  — incoming-call activity + the missed-call auto-text settings.
 *   - Outbound — place AI outbound calls (Lucy dials the lead).
 */
export default function MissedCallPageClient() {
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">
            <Link href="/dashboard/overview" className="hover:underline">
              Dashboard
            </Link>
            {" / AI Assistant"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">AI Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your AI voice assistant — handle inbound calls and place outbound AI calls.
          </p>
        </div>
        {tab === "inbound" && (
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            aria-expanded={settingsOpen}
            aria-controls="missed-call-settings-panel"
          >
            <SettingsIcon className="h-4 w-4" strokeWidth={2} />
            Settings
            {settingsOpen ? (
              <ChevronUp className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {(
          [
            { id: "inbound", label: "Inbound" },
            { id: "outbound", label: "Outbound" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "inbound" ? (
        <>
          {settingsOpen && (
            <section
              id="missed-call-settings-panel"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Settings</h2>
              <p className="mb-4 text-xs text-slate-500">
                Forward number, auto-text template, and AI personalization. Saved settings apply to
                every future call.
              </p>
              <MissedCallSettingsForm />
            </section>
          )}

          <MissedCallActivityLog />

          <p className="text-xs text-slate-500">
            Looking for the rest of your voice and AI settings?{" "}
            <Link href="/dashboard/settings" className="text-blue-700 hover:underline">
              Open Settings
            </Link>
            .
          </p>
        </>
      ) : (
        <OutboundCallPanel />
      )}
    </div>
  );
}
