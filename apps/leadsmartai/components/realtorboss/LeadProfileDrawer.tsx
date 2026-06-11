"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * Lead profile drawer — the constitution's lead experience: a PERSON
 * (story, relationship, what the team has done, what to do next), not
 * a database record. Opens over the Boss dashboard so the Realtor
 * never leaves the command center for a quick read on someone.
 */

type Person = {
  id: string;
  name: string | null;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  rating: string | null;
  engagement_score: number | null;
  intent: string | null;
  buying_or_selling: string | null;
  timeline: string | null;
  search_location: string | null;
  price_min: number | null;
  price_max: number | null;
  property_address: string | null;
  notes: string | null;
  created_at: string;
  auto_pilot: boolean;
};

type NextBestAction = {
  id: string;
  title: string;
  reason: string | null;
  recommended_action: string | null;
  action_href: string | null;
  expected_outcome: string | null;
};

type TimelineItem = { id: string; at: string; icon: string; title: string; detail: string | null };

type Payload = {
  person: Person;
  tasks: { id: string; title: string; due_at: string | null; priority: string | null }[];
  appointments: { id: string; title: string; starts_at: string }[];
  calls: { id: string; direction: string; status: string; notes: string | null; created_at: string }[];
  messages: { id: string; direction: string; message: string; created_at: string }[];
  activities: { id: string; assistant_type: string; summary: string; outcome: string | null; created_at: string }[];
  nextBestAction: NextBestAction | null;
};

const ASSISTANT_LABELS: Record<string, string> = {
  receptionist: "AI Receptionist",
  sales_assistant: "AI Sales Assistant",
  transaction_assistant: "AI Transaction Assistant",
  boss_assistant: "Boss Assistant",
};

function fmtAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function fmtMoney(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;
}

export function LeadProfileDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!leadId) return;
    let cancelled = false;
    fetch(`/api/dashboard/realtorboss/lead/${leadId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok) setData(j as Payload);
        else setError(j?.error ?? "Could not load this lead.");
      })
      .catch(() => !cancelled && setError("Could not load this lead."));
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Merge every interaction into one relationship timeline.
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!data) return [];
    const items: TimelineItem[] = [
      ...data.activities.map((a) => ({
        id: `act-${a.id}`,
        at: a.created_at,
        icon: "⚡",
        title: `${ASSISTANT_LABELS[a.assistant_type] ?? a.assistant_type}: ${a.summary}`,
        detail: a.outcome,
      })),
      ...data.calls.map((c) => ({
        id: `call-${c.id}`,
        at: c.created_at,
        icon: "📞",
        title: `${c.direction === "inbound" ? "Inbound" : "Outbound"} call · ${c.status}`,
        detail: c.notes?.replace(/^AI call summary:\s*/i, "") ?? null,
      })),
      ...data.messages.map((m) => ({
        id: `sms-${m.id}`,
        at: m.created_at,
        icon: "💬",
        title: m.direction === "inbound" ? "They texted" : "AI team texted",
        detail: m.message,
      })),
      ...data.appointments.map((e) => ({
        id: `evt-${e.id}`,
        at: e.starts_at,
        icon: "📅",
        title: e.title,
        detail: new Date(e.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 14);
  }, [data]);

  if (!leadId) return null;
  const p = data?.person;
  const story = p
    ? [
        p.buying_or_selling ? (p.buying_or_selling === "selling" ? "Seller" : "Buyer") : null,
        p.timeline ? `timeline ${p.timeline}` : null,
        p.search_location ? `looking in ${p.search_location}` : null,
        p.price_min != null && p.price_max != null ? `${fmtMoney(p.price_min)}–${fmtMoney(p.price_max)}` : null,
        p.property_address ? `re: ${p.property_address}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Lead profile">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        {error && <p className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {!data && !error && <p className="m-6 text-center text-sm text-gray-400">Getting the full picture…</p>}
        {p && (
          <>
            {/* ── Who they are ── */}
            <div className="border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-gray-900">{p.name ?? "Unnamed lead"}</h2>
                  <p className="text-xs text-gray-500">
                    {[p.source, `with you since ${new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {p.rating && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.rating === "hot" ? "bg-red-100 text-red-700" : p.rating === "warm" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {p.rating}{typeof p.engagement_score === "number" ? ` · ${p.engagement_score}` : ""}
                    </span>
                  )}
                  <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close panel">
                    ✕
                  </button>
                </div>
              </div>
              {(p.intent || story) && (
                <p className="mt-2 text-sm text-gray-700">{p.intent ?? story}</p>
              )}
              {p.intent && story && <p className="mt-0.5 text-xs text-gray-500">{story}</p>}
              {p.auto_pilot && (
                <p className="mt-1.5 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  AI Sales Assistant is handling follow-ups
                </p>
              )}
            </div>

            <div className="space-y-4 px-4 py-4">
              {/* ── Next best action ── */}
              {data?.nextBestAction && (
                <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8a6a0e]">Next best action</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{data.nextBestAction.title}</p>
                  {data.nextBestAction.reason && <p className="text-xs text-gray-600">{data.nextBestAction.reason}</p>}
                  {data.nextBestAction.expected_outcome && (
                    <p className="mt-0.5 text-xs font-medium text-[#8a6a0e]">→ {data.nextBestAction.expected_outcome}</p>
                  )}
                </div>
              )}

              {/* ── Notes (the relationship, in the Realtor's words) ── */}
              {p.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">What you know</p>
                  <p className="mt-1 text-sm leading-snug text-gray-700">{p.notes}</p>
                </div>
              )}

              {/* ── Open tasks for this person ── */}
              {data && data.tasks.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Open follow-ups</p>
                  <ul className="mt-1 space-y-1">
                    {data.tasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                        <span className="min-w-0 truncate">☐ {t.title}</span>
                        {t.due_at && (
                          <span className={`shrink-0 text-xs ${new Date(t.due_at).getTime() < Date.now() ? "font-medium text-red-600" : "text-gray-400"}`}>
                            {new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Relationship timeline ── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Story so far</p>
                {timeline.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-400">No interactions yet — your AI team will log calls, texts, and follow-ups here.</p>
                ) : (
                  <ol className="mt-1.5 space-y-2">
                    {timeline.map((item) => (
                      <li key={item.id} className="flex gap-2">
                        <span className="mt-0.5 text-sm" aria-hidden>{item.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800">{item.title}</p>
                          {item.detail && <p className="line-clamp-2 text-xs text-gray-500">{item.detail}</p>}
                          <p className="text-[10px] text-gray-400">{fmtAgo(item.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div className="mt-auto flex items-center gap-2 border-t border-gray-100 bg-slate-50/60 px-4 py-3">
              <Link
                href={`/dashboard/contacts?list=leads&highlight=${encodeURIComponent(p.id)}`}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
              >
                Open full profile
              </Link>
              <Link href="/dashboard/inbox" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Conversations
              </Link>
              {p.phone && (
                <a href={`tel:${p.phone}`} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Call {p.first_name ?? ""}
                </a>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
