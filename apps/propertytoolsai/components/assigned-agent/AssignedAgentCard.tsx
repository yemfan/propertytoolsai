"use client";

import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";

function telHref(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (!d) return "#";
  if (phone.trim().startsWith("+")) return `tel:${phone.trim()}`;
  if (d.length === 10) return `tel:+1${d}`;
  return `tel:+${d}`;
}

export default function AssignedAgentCard() {
  const [agent, setAgent] = useState<AssignedAgentPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/consumer/assigned-agent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; agent?: AssignedAgentPayload | null } | null) => {
        if (cancelled || !data?.ok) return;
        setAgent(data.agent ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3">
        <div className="mx-auto h-20 w-20 rounded-full bg-slate-200" />
        <div className="h-3 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-9 rounded-xl bg-slate-200" />
          <div className="h-9 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
        No assigned agent. Set <code className="text-[10px]">CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT</code> for a default.
      </div>
    );
  }

  const email = agent.email?.trim();
  const phone = agent.phone?.trim();

  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 shadow-inner">
          {agent.avatarUrl ? (
            <Image
              src={agent.avatarUrl}
              alt={`${agent.displayName} profile photo`}
              fill
              unoptimized
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">
              {agent.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-slate-900">{agent.displayName}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {agent.assignmentSource === "profile" ? "Your agent" : "Default agent"}
        </p>
      </div>

      {/*
       * Call + Email as inline icon-next-to-label buttons (not stacked
       * two-line tiles). The email string itself is intentionally NOT
       * shown in the card — the Email button's mailto: target carries it.
       * The `title` attribute on the mailto anchor still exposes the
       * address on hover for desktop users.
       */}
      <div className="grid grid-cols-2 gap-1.5">
        {phone ? (
          <a
            href={telHref(phone)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-[#0072ce]/40 hover:text-[#0072ce]"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Call
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200/80 px-2 py-2 text-xs text-slate-400">
            <Phone className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
            Call
          </span>
        )}
        {email ? (
          <a
            href={`mailto:${encodeURIComponent(email)}`}
            title={email}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-[#0072ce]/40 hover:text-[#0072ce]"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Email
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200/80 px-2 py-2 text-xs text-slate-400">
            <Mail className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
            Email
          </span>
        )}
      </div>
    </div>
  );
}
