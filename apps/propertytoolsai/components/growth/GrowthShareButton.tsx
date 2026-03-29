"use client";

import { useState } from "react";

export default function GrowthShareButton(props: {
  toolSlug: string;
  title: string;
  summary?: string;
  result: Record<string, unknown>;
  refCode?: string | null;
  brand?: "leadsmart" | "propertytools";
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function createShare() {
    setBusy(true);
    setLink(null);
    try {
      const r = await fetch("/api/growth/shareable-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: props.brand ?? "propertytools",
          tool_slug: props.toolSlug,
          title: props.title,
          summary: props.summary,
          result: props.result,
          ref_code: props.refCode ?? undefined,
          ttl_days: 90,
        }),
      });
      const j = await r.json();
      if (j.ok && j.sharePath && j.id) {
        const url = `${window.location.origin}${j.sharePath}`;
        setLink(url);
        if (props.refCode) {
          await fetch("/api/growth/referral/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: props.refCode,
              event_type: "share",
              page_path: props.toolSlug,
            }),
          }).catch(() => {});
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void createShare()}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Creating link…" : "Create share link"}
      </button>
      {link && (
        <div className="text-xs break-all rounded-lg border border-slate-200 bg-slate-50 p-2">
          {link}
          <button
            type="button"
            className="block mt-2 text-blue-700 font-semibold"
            onClick={() => void navigator.clipboard.writeText(link)}
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
