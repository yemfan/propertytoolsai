"use client";

import { useState } from "react";

export function GreetingPreviewPanel({ leadId }: { leadId: string }) {
  const [preview, setPreview] = useState<{
    generated?: { subject?: string | null; body?: string; tags?: string[] };
    event?: { type?: string };
    channel?: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function loadPreview() {
    try {
      setError("");
      const res = await fetch("/api/admin/greetings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        generated?: { subject?: string | null; body?: string; tags?: string[] };
        event?: { type?: string };
        channel?: string;
      };
      if (!res.ok || !json?.success) throw new Error(json?.error || "Preview failed");
      setPreview(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Greeting preview</h2>
        <button
          type="button"
          onClick={() => void loadPreview()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Generate preview
        </button>
      </div>
      <div className="space-y-3 p-5 text-sm">
        {error ? <div className="text-red-600">{error}</div> : null}
        {preview ? (
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <strong>Event:</strong> {preview.event?.type}
            </div>
            <div>
              <strong>Channel:</strong> {preview.channel}
            </div>
            {preview.generated?.subject ? (
              <div>
                <strong>Subject:</strong> {preview.generated.subject}
              </div>
            ) : null}
            <div className="mt-2 whitespace-pre-wrap text-slate-800">{preview.generated?.body}</div>
          </div>
        ) : (
          <div className="text-slate-500">No preview yet.</div>
        )}
      </div>
    </section>
  );
}
