"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Row = {
  id: string;
  tool: string;
  label: string | null;
  property_address: string | null;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
};

const TOOL_LABELS: Record<string, string> = {
  mortgage_calculator: "Mortgage calculator",
  affordability_calculator: "Affordability calculator",
  cap_rate_calculator: "Cap rate",
  cash_flow_calculator: "Cash flow",
  roi_calculator: "ROI",
  down_payment_calculator: "Down payment",
  refinance_calculator: "Refinance",
  closing_cost_estimator: "Closing costs",
  property_investment_analyzer: "Investment analyzer",
  rent_vs_buy: "Rent vs buy",
  adjustable_rate_calculator: "ARM",
  ai_deal_analyzer: "AI deal analyzer",
  ai_cma_analyzer: "AI CMA",
  rental_property_analyzer: "Rental property",
};

const TOOL_HREF: Record<string, string> = {
  mortgage_calculator: "/mortgage-calculator",
  affordability_calculator: "/affordability-calculator",
  cap_rate_calculator: "/cap-rate-calculator",
  cash_flow_calculator: "/cash-flow-calculator",
  roi_calculator: "/roi-calculator",
  down_payment_calculator: "/down-payment-calculator",
  refinance_calculator: "/refinance-calculator",
  closing_cost_estimator: "/closing-cost-estimator",
  property_investment_analyzer: "/property-investment-analyzer",
  rent_vs_buy: "/rent-vs-buy",
  adjustable_rate_calculator: "/adjustable-rate-calculator",
  ai_deal_analyzer: "/ai-real-estate-deal-analyzer",
  ai_cma_analyzer: "/ai-cma-analyzer",
  rental_property_analyzer: "/rental-property-analyzer",
};

export default function SavedResultsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-results");
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        rows?: Row[];
        error?: string;
      } | null;
      if (!res.ok || !body?.ok || !Array.isArray(body.rows)) {
        setError(body?.error ?? "Failed to load.");
        return;
      }
      setNeedsAuth(false);
      setRows(body.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = supabaseBrowser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void load();
      else setNeedsAuth(true);
    });
    return () => subscription.unsubscribe();
  }, [load]);

  async function deleteRow(id: string) {
    if (!confirm("Delete this saved result?")) return;
    const res = await fetch(`/api/saved-results/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  }

  const grouped = useMemo(() => {
    const by = new Map<string, Row[]>();
    for (const r of rows) {
      const list = by.get(r.tool) ?? [];
      list.push(r);
      by.set(r.tool, list);
    }
    return Array.from(by.entries()).sort(
      ([a], [b]) => a.localeCompare(b),
    );
  }, [rows]);

  if (needsAuth) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Sign in to see your saved results
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Saved calculator scenarios live in your account. Sign in or create a
          free account to access them.
        </p>
        <button
          type="button"
          onClick={() => setNeedsAuth(true)}
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </button>
        <AuthModal
          open={needsAuth}
          onClose={() => setNeedsAuth(false)}
          onAuthenticated={() => {
            setNeedsAuth(false);
            void load();
          }}
          initialMode="login"
        />
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          No saved results yet
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Run any calculator and click &quot;Save Results&quot; to keep a
          scenario here.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Browse calculators
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([tool, toolRows]) => (
        <section key={tool}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {TOOL_LABELS[tool] ?? tool}
              <span className="ml-2 font-normal text-slate-500">
                · {toolRows.length}
              </span>
            </h2>
            {TOOL_HREF[tool] ? (
              <Link
                href={TOOL_HREF[tool]}
                className="text-xs text-blue-600 hover:underline"
              >
                Open calculator →
              </Link>
            ) : null}
          </div>
          <ul className="space-y-2">
            {toolRows.map((r) => {
              const isExpanded = expanded === r.id;
              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {r.label || r.property_address || "(unnamed scenario)"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Saved {formatDate(r.created_at)}
                        {r.property_address && r.label
                          ? ` · ${r.property_address}`
                          : ""}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {isExpanded ? "▲" : "▼"}
                    </div>
                  </button>
                  {isExpanded ? (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Inputs
                          </h3>
                          <KeyValueGrid values={r.inputs} />
                        </div>
                        <div>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Results
                          </h3>
                          <KeyValueGrid values={r.results} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => void deleteRow(r.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function KeyValueGrid({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (!entries.length) {
    return <p className="mt-1 text-xs text-slate-400">(none)</p>;
  }
  return (
    <dl className="mt-1 grid grid-cols-1 gap-x-3 gap-y-1 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3">
          <dt className="font-medium text-slate-600">{humanize(k)}</dt>
          <dd className="truncate text-slate-900">{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (typeof v === "number") {
    if (Math.abs(v) >= 1000) {
      return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
