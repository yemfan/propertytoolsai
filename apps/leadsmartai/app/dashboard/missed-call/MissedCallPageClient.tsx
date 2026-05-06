"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings as SettingsIcon, ChevronDown, ChevronUp } from "lucide-react";
import MissedCallActivityLog from "@/components/dashboard/MissedCallActivityLog";
import MissedCallSettingsForm from "@/components/dashboard/MissedCallSettingsForm";

/**
 * Activity-first layout for /dashboard/missed-call.
 *
 * Layout:
 *   - Header with title + Settings toggle button
 *   - When Settings is open: collapsible panel with the form
 *   - Always: full call activity log with auto-text bodies
 *
 * Settings hide-by-default because the agent's recurring use case is
 * "did the auto-text fire on that missed call I see in my missed-call
 * log?" — they don't need the template editor in their face every
 * visit. One click reveals it when they want to tweak.
 */
export default function MissedCallPageClient() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">
            <Link href="/dashboard/overview" className="hover:underline">
              Dashboard
            </Link>
            {" / Missed-call text-back"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Missed-call text-back
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every inbound + outbound call, with the auto-text that went out
            when you didn&apos;t pick up.
          </p>
        </div>
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
      </div>

      {/* Collapsible settings */}
      {settingsOpen && (
        <section
          id="missed-call-settings-panel"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            Settings
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Forward number, auto-text template, and AI personalization. Saved
            settings apply to every future call — no need to re-save when you
            close this panel.
          </p>
          <MissedCallSettingsForm />
        </section>
      )}

      {/* Primary content: full call activity log */}
      <MissedCallActivityLog />

      <p className="text-xs text-slate-500">
        Looking for the rest of your voice and AI settings?{" "}
        <Link href="/dashboard/settings" className="text-blue-700 hover:underline">
          Open Settings
        </Link>
        .
      </p>
    </div>
  );
}
