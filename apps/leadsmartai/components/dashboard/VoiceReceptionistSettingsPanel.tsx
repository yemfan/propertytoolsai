"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_RECEPTIONIST_CONFIG,
  type ReceptionistConfig,
} from "@/lib/voice-receptionist/types";

const defaults: ReceptionistConfig = { ...DEFAULT_RECEPTIONIST_CONFIG };

const FIELD =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40";
const LABEL = "block text-[11px] font-medium text-gray-500 mb-1";

export default function VoiceReceptionistSettingsPanel() {
  const [settings, setSettings] = useState<ReceptionistConfig>(defaults);
  const [saved, setSaved] = useState<ReceptionistConfig>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty = (Object.keys(settings) as (keyof ReceptionistConfig)[]).some(
    (k) => settings[k] !== saved[k],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/voice-receptionist-settings", { method: "GET" });
      const data = (await res.json()) as {
        ok?: boolean;
        settings?: ReceptionistConfig;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.error || "Failed to load");
      setSettings(data.settings);
      setSaved(data.settings);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/voice-receptionist-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        settings?: ReceptionistConfig;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.error || "Save failed");
      setSettings(data.settings);
      setSaved(data.settings);
      setMessage("Saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof ReceptionistConfig>(key: K, value: ReceptionistConfig[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setMessage(null);
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500 py-4" aria-busy="true">
        Loading receptionist settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        How your AI phone receptionist introduces itself and what it knows about your business.
        Applied to every inbound call on your receptionist number.
      </p>

      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => update("enabled", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span>Receptionist enabled</span>
        {!settings.enabled && (
          <span className="text-[11px] text-amber-600">— calls won&apos;t be answered by the AI</span>
        )}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className={LABEL}>Business name</span>
          <input
            className={FIELD}
            value={settings.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            placeholder="e.g. Summit Realty"
          />
        </div>
        <div>
          <span className={LABEL}>Business name (Chinese)</span>
          <input
            className={FIELD}
            value={settings.businessNameZh}
            onChange={(e) => update("businessNameZh", e.target.value)}
            placeholder="中文名称（可选）"
          />
        </div>
        <div>
          <span className={LABEL}>Receptionist name</span>
          <input
            className={FIELD}
            value={settings.agentName}
            onChange={(e) => update("agentName", e.target.value)}
            placeholder="e.g. Maria (optional)"
          />
        </div>
        <div>
          <span className={LABEL}>Timezone</span>
          <input
            className={FIELD}
            value={settings.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            placeholder="America/New_York"
          />
        </div>
      </div>

      <div>
        <span className={LABEL}>Custom greeting (optional)</span>
        <input
          className={FIELD}
          value={settings.greeting}
          onChange={(e) => update("greeting", e.target.value)}
          placeholder="Leave blank to auto-generate from your business name"
        />
      </div>

      <div>
        <span className={LABEL}>What the receptionist should know</span>
        <textarea
          className={`${FIELD} min-h-[120px]`}
          value={settings.extraNotes}
          onChange={(e) => update("extraNotes", e.target.value)}
          placeholder="Business hours, services, pricing, address, and FAQs. Also say what to do with callers — e.g. take a message, collect their name + number, or offer a call-back. The receptionist uses this to answer questions."
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!isDirty || saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message && <span className="text-xs font-medium text-green-600">{message}</span>}
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>
    </div>
  );
}
