"use client";

import { useEffect } from "react";

export default function ReportEngagementTracker({
  leadId,
  reportId,
}: {
  leadId: string | null;
  reportId: string;
}) {
  useEffect(() => {
    if (!leadId) return;
    fetch("/api/track/report-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: leadId, report_id: reportId }),
    }).catch(() => {});
  }, [leadId, reportId]);

  return null;
}

