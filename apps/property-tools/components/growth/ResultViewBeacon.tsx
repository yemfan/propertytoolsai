"use client";

import { useEffect, useRef } from "react";

export default function ResultViewBeacon({ id }: { id: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch(`/api/growth/shareable-result/${id}/view`, { method: "POST" });
  }, [id]);
  return null;
}
