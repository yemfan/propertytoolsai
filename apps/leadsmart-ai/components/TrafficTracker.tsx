"use client";

import { useEffect } from "react";

export default function TrafficTracker({
  pagePath,
  city,
  source,
  campaign,
}: {
  pagePath: string;
  city?: string;
  source?: string;
  campaign?: string;
}) {
  useEffect(() => {
    fetch("/api/traffic/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "page_view",
        page_path: pagePath,
        city: city ?? null,
        source: source ?? null,
        campaign: campaign ?? null,
      }),
    }).catch(() => {});
  }, [pagePath, city, source, campaign]);

  return null;
}

