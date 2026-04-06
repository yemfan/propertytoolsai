"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

type PropertyRow = {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  year_built: number | null;
};

type PropertyAI = {
  highlight: string;
  summary: string;
  strengths: string[];
  considerations: string[];
};

type PresentationProperty = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
  low: number | null;
  high: number | null;
  comps: Array<{ address: string; price: number; soldDate: string }>;
  ai: PropertyAI | null;
};

type PresentationData = {
  clientName: string;
  generated_at: string;
  executive_summary: string;
  market_overview: string;
  recommendation: string;
  properties: PresentationProperty[];
};

function fmt(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "\u2014";
  return `$${Math.round(v).toLocaleString()}`;
}

export default function SellerPresentationClient({
  properties,
}: {
  properties: Array<Record<string, unknown>>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<{
    id: string;
    data: PresentationData;
  } | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = (properties as PropertyRow[]).filter((p) =>
      !s || (p.address ?? "").toLowerCase().includes(s) || (p.city ?? "").toLowerCase().includes(s)
    );
    return list;
  }, [properties, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  async function generate() {
    if (!selected.size) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/seller-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyIds: [...selected],
          clientName: clientName || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Generation failed.");
      setPresentation({ id: body.presentationId, data: body.data });
      setTimeout(() => presentationRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!presentationRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");
      const canvas = await html2canvas(presentationRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`seller-presentation-${presentation?.id?.slice(0, 8) ?? "draft"}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    }
  }

  const shareUrl = useMemo(() => {
    if (!presentation?.id || typeof window === "undefined") return "";
    return `${window.location.origin}/presentation/${presentation.id}`;
  }, [presentation?.id]);

  async function emailPresentation() {
    if (!shareEmail.trim() || !shareUrl) return;
    setSharing(true);
    setShareMsg(null);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: shareEmail.trim(),
          subject: `Seller Presentation${clientName ? ` for ${clientName}` : ""}`,
          text: `Hi${clientName ? ` ${clientName}` : ""},\n\nHere is your seller presentation:\n${shareUrl}\n\nThis presentation includes property analysis, market comparisons, and pricing recommendations.\n\nBest regards`,
        }),
      });
      if (res.ok) {
        setShareMsg("Sent!");
        setShareEmail("");
        setTimeout(() => setShareMsg(null), 3000);
      } else {
        setShareMsg("Failed to send.");
      }
    } catch {
      setShareMsg("Network error.");
    } finally {
      setSharing(false);
    }
  }

  // ---------- Selection Phase ----------
  if (!presentation) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Seller Presentation</h1>
          <p className="text-sm text-gray-500">
            Select up to 5 properties to compare. AI will generate professional summaries and highlights.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Search properties</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type address or city..."
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:w-64">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Client name (optional)</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {selected.size}/5 selected
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
            {rows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No properties found.</div>
            ) : (
              rows.map((p) => {
                const id = String(p.id);
                const checked = selected.has(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${checked ? "bg-blue-50/50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                      disabled={!checked && selected.size >= 5}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{p.address || "\u2014"}</div>
                      <div className="text-xs text-gray-500">
                        {[p.city, p.state].filter(Boolean).join(", ")}
                        {p.beds != null && ` \u00b7 ${p.beds}bd`}
                        {p.baths != null && `/${p.baths}ba`}
                        {p.sqft != null && ` \u00b7 ${Number(p.sqft).toLocaleString()} sqft`}
                        {p.year_built != null && ` \u00b7 Built ${p.year_built}`}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
        )}

        <button
          type="button"
          disabled={!selected.size || generating}
          onClick={() => void generate()}
          className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {generating ? "Generating presentation..." : `Generate Presentation (${selected.size} properties)`}
        </button>
      </div>
    );
  }

  // ---------- Presentation View ----------
  const d = presentation.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPresentation(null)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          &larr; New Presentation
        </button>
        <button
          type="button"
          onClick={() => void downloadPdf()}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Download PDF
        </button>
        {shareUrl && (
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(shareUrl); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Copy Share Link
          </button>
        )}
      </div>

      {/* Email to seller */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={shareEmail}
          onChange={(e) => setShareEmail(e.target.value)}
          placeholder="Email presentation to seller..."
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          disabled={sharing || !shareEmail.trim()}
          onClick={() => void emailPresentation()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sharing ? "Sending..." : "Send"}
        </button>
        {shareMsg && <span className={`text-xs ${shareMsg === "Sent!" ? "text-green-700" : "text-red-600"}`}>{shareMsg}</span>}
      </div>

      {/* Printable presentation */}
      <div ref={presentationRef} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-8 text-white">
          <h1 className="text-3xl font-bold tracking-tight">Seller Presentation</h1>
          {d.clientName && <p className="mt-2 text-lg text-slate-300">Prepared for {d.clientName}</p>}
          <p className="mt-1 text-sm text-slate-400">
            {new Date(d.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" \u00b7 "}
            {d.properties.length} {d.properties.length === 1 ? "property" : "properties"}
          </p>
        </div>

        <div className="px-8 py-8 space-y-10">
          {/* Executive Summary */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Executive Summary</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{d.executive_summary}</p>
          </section>

          {/* Market Overview */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Market Overview</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{d.market_overview}</p>
          </section>

          {/* Property Cards */}
          {d.properties.map((p, i) => (
            <section key={p.id || i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{p.address}</h3>
                {p.ai?.highlight && (
                  <p className="mt-1 text-sm font-medium text-blue-700">{p.ai.highlight}</p>
                )}
              </div>

              {/* Key Stats */}
              <div className="flex flex-wrap gap-4 text-sm">
                {p.beds != null && (
                  <div><span className="text-slate-500">Beds</span> <span className="font-semibold">{p.beds}</span></div>
                )}
                {p.baths != null && (
                  <div><span className="text-slate-500">Baths</span> <span className="font-semibold">{p.baths}</span></div>
                )}
                {p.sqft != null && (
                  <div><span className="text-slate-500">Sqft</span> <span className="font-semibold">{Number(p.sqft).toLocaleString()}</span></div>
                )}
                {p.yearBuilt != null && (
                  <div><span className="text-slate-500">Built</span> <span className="font-semibold">{p.yearBuilt}</span></div>
                )}
                {p.propertyType && (
                  <div><span className="text-slate-500">Type</span> <span className="font-semibold capitalize">{p.propertyType}</span></div>
                )}
              </div>

              {/* Estimated Value */}
              {p.estimatedValue != null && (
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Value</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{fmt(p.estimatedValue)}</div>
                  <div className="text-xs text-slate-500">Range: {fmt(p.low)} &ndash; {fmt(p.high)}</div>
                </div>
              )}

              {/* AI Summary */}
              {p.ai?.summary && (
                <p className="text-sm leading-relaxed text-slate-700">{p.ai.summary}</p>
              )}

              {/* Strengths & Considerations */}
              <div className="grid gap-4 sm:grid-cols-2">
                {p.ai?.strengths?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-green-700">Strengths</h4>
                    <ul className="mt-1 space-y-1">
                      {p.ai.strengths.map((s, j) => (
                        <li key={j} className="flex gap-2 text-sm text-slate-700">
                          <span className="text-green-600 shrink-0">+</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {p.ai?.considerations?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Considerations</h4>
                    <ul className="mt-1 space-y-1">
                      {p.ai.considerations.map((c, j) => (
                        <li key={j} className="flex gap-2 text-sm text-slate-700">
                          <span className="text-amber-600 shrink-0">&bull;</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* Comparable Sales */}
              {p.comps?.length ? (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Comparable Sales</h4>
                  <div className="mt-2 space-y-1">
                    {p.comps.slice(0, 3).map((c, j) => (
                      <div key={j} className="flex items-center justify-between rounded-lg bg-white border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-700 truncate">{c.address}</span>
                        <div className="flex gap-4 text-xs text-slate-500 shrink-0 ml-3">
                          <span className="font-semibold text-slate-900">{fmt(c.price)}</span>
                          <span>{c.soldDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}

          {/* Comparison Table (multi-property) */}
          {d.properties.length > 1 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Side-by-Side Comparison</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Property</th>
                      <th className="px-4 py-2 text-right font-medium">Est. Value</th>
                      <th className="px-4 py-2 text-right font-medium">Beds</th>
                      <th className="px-4 py-2 text-right font-medium">Baths</th>
                      <th className="px-4 py-2 text-right font-medium">Sqft</th>
                      <th className="px-4 py-2 text-right font-medium">$/Sqft</th>
                      <th className="px-4 py-2 text-right font-medium">Built</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.properties.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-900 max-w-[200px] truncate">{p.address}</td>
                        <td className="px-4 py-2 text-right">{fmt(p.estimatedValue)}</td>
                        <td className="px-4 py-2 text-right">{p.beds ?? "\u2014"}</td>
                        <td className="px-4 py-2 text-right">{p.baths ?? "\u2014"}</td>
                        <td className="px-4 py-2 text-right">{p.sqft != null ? Number(p.sqft).toLocaleString() : "\u2014"}</td>
                        <td className="px-4 py-2 text-right">{p.avgPricePerSqft != null ? `$${Math.round(Number(p.avgPricePerSqft))}` : "\u2014"}</td>
                        <td className="px-4 py-2 text-right">{p.yearBuilt ?? "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Recommendation */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Recommendation</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{d.recommendation}</p>
          </section>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            Generated by LeadSmart AI &middot; {new Date(d.generated_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
