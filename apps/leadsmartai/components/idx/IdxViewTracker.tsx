"use client";

import { useEffect, useState } from "react";

import IdxLeadCaptureModal, {
  type IdxLeadContext,
} from "@/components/idx/IdxLeadCaptureModal";

const STORAGE_KEY = "idx_views_v1";
const TRIGGER_KEY = "idx_view_threshold_triggered_v1";
const VIEW_THRESHOLD = 3;

/**
 * Cookie-/localStorage-backed view counter mounted on every PDP. Once the
 * consumer has viewed N detail pages without registering, surface the
 * lead-capture modal as a soft gate. We do NOT block the content — TCPA and
 * fair-housing concerns aside, hard gates also tank SEO. The modal is closable
 * and we set a `triggered` flag so it does not nag.
 *
 * Sign-in / capture should clear `STORAGE_KEY` upstream; for MVP a hit on the
 * lead-capture endpoint clears it via the `onCaptured` callback.
 */
export default function IdxViewTracker(props: {
  listingId: string;
  listingAddress: string;
  listingPrice: number | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(TRIGGER_KEY) === "1") return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      if (!seen.includes(props.listingId)) {
        seen.push(props.listingId);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen.slice(-25)));
      }
      if (seen.length >= VIEW_THRESHOLD) {
        window.localStorage.setItem(TRIGGER_KEY, "1");
        // Defer slightly so the page paints before the modal — better LCP, less jarring.
        const t = window.setTimeout(() => setOpen(true), 1200);
        return () => window.clearTimeout(t);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — silently no-op. Threshold gate
      // is a nice-to-have, not a correctness path.
    }
  }, [props.listingId]);

  const context: IdxLeadContext = {
    action: "view_threshold",
    listingId: props.listingId,
    listingAddress: props.listingAddress,
    listingPrice: props.listingPrice,
  };

  return (
    <IdxLeadCaptureModal
      open={open}
      onClose={() => setOpen(false)}
      context={context}
      onCaptured={() => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
          // Keep TRIGGER_KEY so we don't re-prompt the same session.
        } catch {}
        setOpen(false);
      }}
    />
  );
}
