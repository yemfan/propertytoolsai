"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ContactView, RelationshipType } from "@/lib/contacts/types";
import { currencyFormat, percentFormat, relationshipLabel } from "@/lib/contacts/formatters";

type Filter = "all" | "past_buyers" | "past_sellers" | "sphere" | "referral" | "dormant";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "past_buyers", label: "Past buyers" },
  { id: "past_sellers", label: "Past sellers" },
  { id: "sphere", label: "Sphere" },
  { id: "referral", label: "Referrers" },
  { id: "dormant", label: "Dormant 90d+" },
];

function match(c: ContactView, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "dormant") return c.reasonType === "dormant";
  const rel: Record<Exclude<Filter, "all" | "dormant">, RelationshipType[]> = {
    past_buyers: ["past_buyer", "past_both"],
    past_sellers: ["past_seller", "past_both"],
    sphere: ["sphere"],
    referral: ["referral_source"],
  };
  return c.relationshipType !== null && rel[f].includes(c.relationshipType);
}

export default function SphereDashboardClient({ contacts }: { contacts: ContactView[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(contacts[0]?.id ?? null);

  const visible = useMemo(() => contacts.filter((c) => match(c, filter)), [contacts, filter]);
  const selected = contacts.find((c) => c.id === selectedId) ?? visible[0] ?? null;

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-8 text-sm text-amber-900">
        <div className="text-base font-semibold">No sphere contacts yet.</div>
        <p className="mt-1 max-w-prose">
          Import past clients from CSV, FUB, kvCORE, or Sierra. Imports require per-contact
          anniversary-opt-in confirmation per spec §2.8 — the import flow is queued for the next PR.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
      <aside className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Today</div>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Who to touch today.</h2>
          <p className="mt-1 text-xs text-gray-500">
            {visible.length} above the line.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  filter === f.id
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
          {visible.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`grid w-full grid-cols-[auto_auto_1fr] items-center gap-3 px-4 py-3 text-left transition-colors ${
                  selected?.id === c.id ? "bg-brand-accent/5" : "hover:bg-gray-50"
                }`}
              >
                <span className="font-mono text-[10px] text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: c.avatarColor }}
                >
                  {c.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{c.fullName}</span>
                  <span className="block truncate text-[11px] text-gray-500">{c.topReason}</span>
                </span>
              </button>
            </li>
          ))}
          {!visible.length && (
            <li className="p-6 text-center text-sm text-gray-400">No contacts match.</li>
          )}
        </ul>
      </aside>

      <main className="rounded-xl border border-gray-200 bg-white">
        {selected ? (
          <ContactPreview contact={selected} />
        ) : (
          <div className="p-8 text-sm text-gray-500">Select a contact.</div>
        )}
      </main>
    </div>
  );
}

function ContactPreview({ contact }: { contact: ContactView }) {
  return (
    <div className="p-6">
      <div className="flex items-start gap-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: contact.avatarColor }}
        >
          {contact.initials}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900">{contact.fullName}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{relationshipLabel(contact.relationshipType)}</span>
            {contact.relationshipTag && (
              <>
                <span>·</span>
                <span>{contact.relationshipTag}</span>
              </>
            )}
          </div>
        </div>
        <Link
          href={`/dashboard/sphere/${contact.id}`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Open profile →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PreviewStat label="Top reason" value={contact.topReason} />
        <PreviewStat
          label="Equity delta"
          value={
            contact.equityDelta !== null
              ? `${currencyFormat(contact.equityDelta)} · ${percentFormat(contact.equityPct)}`
              : "—"
          }
        />
        <PreviewStat
          label="Last touch"
          value={contact.dormancyDays !== null ? `${contact.dormancyDays}d ago` : "Never"}
        />
      </div>

      {contact.signals.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Open signals — calling list only
          </div>
          <ul className="mt-2 space-y-2">
            {contact.signals.map((s) => (
              <li key={s.id} className="text-sm text-amber-900">
                <span className="font-medium">{s.label}</span>
                {s.suggestedAction && (
                  <span className="ml-2 text-xs text-amber-700">— {s.suggestedAction}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-700/80">
            Life-event signals never auto-send. Per spec §2.6.3.
          </p>
        </div>
      )}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
