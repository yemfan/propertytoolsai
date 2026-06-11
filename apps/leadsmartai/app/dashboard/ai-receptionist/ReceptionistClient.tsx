"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAssistant } from "@/lib/realtorboss/team";
import { AssistantHeader, AssistantKpiCard } from "@/components/realtorboss/AssistantPage";

type CallEvent = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  direction: "inbound" | "outbound";
  status: string;
  from_phone: string | null;
  duration_seconds: number | null;
  textback_sent: boolean;
  textback_status: string | null;
  created_at: string;
};

const assistant = getAssistant("receptionist");

export default function ReceptionistClient() {
  const [calls, setCalls] = useState<CallEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/missed-call/events?limit=50")
      .then((r) => r.json())
      .catch(() => ({}));
    setCalls((res?.events ?? []) as CallEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const todayMidnight = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }, []);

  const inboundToday = calls.filter(
    (c) => c.direction === "inbound" && new Date(c.created_at).getTime() >= todayMidnight,
  );
  const answeredToday = inboundToday.filter((c) => c.status === "completed");
  const leadsCapturedToday = inboundToday.filter((c) => c.contact_id != null);
  const recovered = calls.filter((c) => c.direction === "inbound" && c.status !== "completed" && c.textback_sent);
  const needsHuman = calls.filter((c) => c.direction === "inbound" && c.status !== "completed" && !c.textback_sent);

  return (
    <div className="space-y-4">
      <AssistantHeader
        assistant={assistant}
        actions={[
          { label: "Voice console", href: "/dashboard/missed-call" },
          { label: "Voice settings", href: "/dashboard/settings" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AssistantKpiCard label="Calls answered today" value={loading ? undefined : answeredToday.length} />
        <AssistantKpiCard label="New leads captured today" value={loading ? undefined : leadsCapturedToday.length} />
        <AssistantKpiCard label="Missed calls recovered" value={loading ? undefined : recovered.length} hint="text-back sent" />
        <AssistantKpiCard label="Needing human follow-up" value={loading ? undefined : needsHuman.length} tone={needsHuman.length > 0 ? "warn" : undefined} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent Conversations</h2>
          <Link href="/dashboard/missed-call" className="text-xs font-medium text-blue-600 hover:text-blue-800">Open voice console</Link>
        </div>
        {calls.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {loading ? "Loading call activity…" : "No calls yet. Once your AI Receptionist starts answering, every conversation shows up here."}
          </p>
        ) : (
          <div className="space-y-2">
            {calls.slice(0, 15).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {c.contact_name ?? c.from_phone ?? "Unknown caller"}
                    <span className="ml-2 text-xs font-normal text-gray-400">{c.direction}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.status}
                    {c.duration_seconds != null ? ` · ${Math.round(c.duration_seconds / 60)}m` : ""}
                    {c.textback_sent ? ` · text-back ${c.textback_status ?? "sent"}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
