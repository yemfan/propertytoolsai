"use client";

import { useEffect } from "react";
import { PostcardScene } from "@/components/postcards/animations";
import type { PublicPostcardView } from "@/lib/postcards/types";

/**
 * Unauthenticated public viewer. Fires a beacon on mount to stamp
 * `opened_at` server-side, then renders the animation + the agent's
 * personal message + reply-via-call/text buttons.
 */
export function PostcardViewerClient({
  view,
  slug,
}: {
  view: PublicPostcardView;
  slug: string;
}) {
  useEffect(() => {
    // Fire-and-forget open beacon. Navigator.sendBeacon is ideal
    // for this — doesn't block the UI and survives page-leave.
    try {
      const payload = new Blob(["{}"], { type: "application/json" });
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon(`/api/postcard/${slug}/open`, payload);
      } else {
        void fetch(`/api/postcard/${slug}/open`, { method: "POST" });
      }
    } catch {
      /* best-effort */
    }
  }, [slug]);

  return (
    <div className="min-h-screen bg-white">
      <PostcardScene
        templateKey={view.templateKey}
        recipientName={view.recipientName}
        personalMessage={view.personalMessage}
        agentName={view.agentName}
        agentPhotoUrl={view.agentPhotoUrl}
        brandName={view.brandName}
      />

      {/* Reply CTAs — bottom of the page, always visible after scroll */}
      <div className="mx-auto mt-8 flex max-w-xl flex-wrap gap-3 px-4 pb-12">
        {view.agentPhone ? (
          <a
            href={`tel:${view.agentPhone}`}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
          >
            📞 Call
          </a>
        ) : null}
        {view.agentPhone ? (
          <a
            href={`sms:${view.agentPhone}`}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            💬 Text back
          </a>
        ) : null}
        {view.agentEmail ? (
          <a
            href={`mailto:${view.agentEmail}`}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            ✉️ Reply
          </a>
        ) : null}
      </div>
    </div>
  );
}
