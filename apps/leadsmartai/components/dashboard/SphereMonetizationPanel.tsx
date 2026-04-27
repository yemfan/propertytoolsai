"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  filterMonetizationRows,
  type MonetizationFilter,
  type MonetizationRow,
} from "@/lib/sphereMonetization/mergeRows";

const LABEL_TONE: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-slate-50 text-slate-600 ring-slate-200",
};

const FILTERS: { value: MonetizationFilter; label: string; hint: string }[] = [
  { value: "all", label: "All", hint: "Every contact ranked by combined score" },
  { value: "both_high", label: "Both high", hint: "Strong on both sell + buy — top leverage" },
  { value: "seller_leaning", label: "Seller-leaning", hint: "Higher seller score" },
  { value: "buyer_leaning", label: "Buyer-leaning", hint: "Higher buyer score" },
];

/**
 * Combined sphere-monetization panel — one row per contact with the
 * seller-side and buyer-side scores side-by-side. Answers "where is the
 * agent's biggest opportunity overall?" without the agent having to flip
 * between the two ranked lists.
 *
 * The chip filters mirror the strategic cuts the gap-analysis flagged:
 *   both_high      — top leverage (sell-then-buy concurrent moves)
 *   seller_leaning — list first, talk equity
 *   buyer_leaning  — relocation/upgrade play, talk inventory
 *   all            — full ranked view
 */
export default function SphereMonetizationPanel(
  props: { defaultLimitPerSide?: number } = {},
) {
  const limitPerSide = props.defaultLimitPerSide ?? 100;

  const [rows, setRows] = useState<MonetizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MonetizationFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/dashboard/sphere/monetization?limitPerSide=${limitPerSide}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          rows?: MonetizationRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || data.ok === false) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setRows(data.rows ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limitPerSide]);

  const filtered = useMemo(
    () => filterMonetizationRows(rows, filter),
    [rows, filter],
  );

  const kpis = useMemo(() => computeKpis(rows), [rows]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Sphere monetization</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Past clients + sphere with their seller-side AND buyer-side scores side-by-side. The combined score surfaces the highest-leverage contacts overall.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              title={f.hint}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                filter === f.value
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <KpiStrip kpis={kpis} loading={loading} />

      <div className="p-3 sm:p-4">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="h-16 animate-pulse rounded-xl bg-slate-100"
                aria-hidden
              />
            ))}
          </ul>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Couldn&apos;t load monetization view: {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            {rows.length === 0
              ? "No past clients or sphere contacts to score yet. Import contacts + capture signals to start surfacing leverage."
              : `No matches for "${filterCopy(filter)}". Try a different filter.`}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <li key={r.contactId}>
                <Link
                  href={`/dashboard/contacts/${encodeURIComponent(r.contactId)}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50 sm:gap-4"
                >
                  <CombinedBadge score={r.combinedScore} bothHigh={r.bothMediumOrHigh} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {r.fullName}
                      </p>
                      <LifecyclePill stage={r.lifecycleStage} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {bestReason(r)}
                    </p>
                    {r.closingAddress ? (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {r.closingAddress}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <SidePill kind="sell" side={r.seller} />
                    <SidePill kind="buy" side={r.buyer} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type Kpis = {
  total: number;
  bothHigh: number;
  sellerLeaning: number;
  buyerLeaning: number;
};

function computeKpis(rows: ReadonlyArray<MonetizationRow>): Kpis {
  return {
    total: rows.length,
    bothHigh: filterMonetizationRows(rows, "both_high").length,
    sellerLeaning: filterMonetizationRows(rows, "seller_leaning").length,
    buyerLeaning: filterMonetizationRows(rows, "buyer_leaning").length,
  };
}

function KpiStrip({ kpis, loading }: { kpis: Kpis; loading: boolean }) {
  const cells: { label: string; value: number; tone: string }[] = [
    { label: "Contacts ranked", value: kpis.total, tone: "text-slate-900" },
    { label: "Both-high leverage", value: kpis.bothHigh, tone: "text-emerald-700" },
    { label: "Seller-leaning", value: kpis.sellerLeaning, tone: "text-indigo-700" },
    { label: "Buyer-leaning", value: kpis.buyerLeaning, tone: "text-amber-700" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {c.label}
          </p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${c.tone}`}>
            {loading ? "—" : c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function CombinedBadge({ score, bothHigh }: { score: number; bothHigh: boolean }) {
  const tone = bothHigh
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 100
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-50 text-slate-600 ring-slate-200";
  return (
    <div
      className={`flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ${tone}`}
      aria-label={`Combined score ${score}${bothHigh ? ", both sides medium-or-high" : ""}`}
    >
      <span className="text-base font-bold leading-none tabular-nums">{score}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide">
        combined
      </span>
    </div>
  );
}

function SidePill({
  kind,
  side,
}: {
  kind: "sell" | "buy";
  side: { score: number; label: string } | null;
}) {
  if (!side) {
    return (
      <span className="inline-flex flex-col items-center rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 ring-1 ring-slate-100">
        <span className="leading-none">{kind === "sell" ? "Sell" : "Buy"}</span>
        <span className="mt-0.5 text-base font-bold leading-none tabular-nums">—</span>
      </span>
    );
  }
  const labelTone = LABEL_TONE[(side.label as "high" | "medium" | "low") ?? "low"];
  return (
    <span
      className={`inline-flex flex-col items-center rounded-lg px-2 py-1 ring-1 ${labelTone}`}
      aria-label={`${kind === "sell" ? "Seller" : "Buyer"} score ${side.score}, ${side.label}`}
    >
      <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">
        {kind === "sell" ? "Sell" : "Buy"}
      </span>
      <span className="mt-0.5 text-base font-bold leading-none tabular-nums">
        {side.score}
      </span>
    </span>
  );
}

function LifecyclePill({ stage }: { stage: MonetizationRow["lifecycleStage"] }) {
  const copy =
    stage === "past_client"
      ? "Past client"
      : stage === "sphere"
        ? "Sphere"
        : stage.replace(/_/g, " ");
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
      {copy}
    </span>
  );
}

function bestReason(r: MonetizationRow): string {
  if (r.seller && r.buyer) {
    return r.seller.score >= r.buyer.score
      ? `Sell: ${r.seller.topReason}`
      : `Buy: ${r.buyer.topReason}`;
  }
  if (r.seller) return `Sell: ${r.seller.topReason}`;
  if (r.buyer) return `Buy: ${r.buyer.topReason}`;
  return "";
}

function filterCopy(f: MonetizationFilter): string {
  switch (f) {
    case "all":
      return "All";
    case "both_high":
      return "Both high";
    case "seller_leaning":
      return "Seller-leaning";
    case "buyer_leaning":
      return "Buyer-leaning";
  }
}
