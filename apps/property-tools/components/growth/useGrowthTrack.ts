"use client";

import { useCallback } from "react";

type TrackPayload = {
  event_type: "page_view" | "tool_usage" | "conversion";
  page_path: string;
  city?: string | null;
  source?: string | null;
  campaign?: string | null;
  referral_code?: string | null;
  tool_slug?: string | null;
  lead_quality?: string | null;
  metadata?: Record<string, unknown>;
};

export function useGrowthTrack() {
  return useCallback(async (payload: TrackPayload) => {
    try {
      await fetch("/api/growth/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* non-blocking */
    }
  }, []);
}
