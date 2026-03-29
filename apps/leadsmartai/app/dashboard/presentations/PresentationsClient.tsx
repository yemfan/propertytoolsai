"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type PresentationData = {
  property: {
    address: string;
    city: string | null;
    state: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    propertyType: string | null;
    yearBuilt: number | null;
  };
  estimate: {
    estimatedValue: number | null;
    low: number | null;
    high: number | null;
    avgPricePerSqft: number | null;
    summary: string;
  };
  comps: Array<{
    address: string;
    price: number;
    sqft: number;
    pricePerSqft: number;
    distanceMiles: number;
    soldDate: string;
    beds: number | null;
    baths: number | null;
    propertyType: string | null;
  }>;
  pricing_strategy: string;
  market_insights: string;
  marketing_plan: string;
};

type GeneratePresentationResponse = {
  presentation_id: string;
  data: PresentationData;
};

type PresentationHistoryRow = {
  id: string;
  property_address: string | null;
  created_at: string | null;
};

export default function PresentationsClient({
  initialPresentations,
}: {
  initialPresentations: PresentationHistoryRow[];
}) {
  const [address, setAddress] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<{
    presentationId: string;
    data: PresentationData;
  } | null>(null);

  const [history, setHistory] = useState<PresentationHistoryRow[]>(
    initialPresentations ?? []
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!presentation?.presentationId) return "";
    const origin = window.location.origin;
    return `${origin}/presentation/${encodeURIComponent(presentation.presentationId)}`;
  }, [presentation?.presentationId]);

  const formatCurrency = (value: number | null) =>
    value == null || !Number.isFinite(value)
      ? "—"
      : `$${Math.round(value).toLocaleString()}`;

  const canGenerate = address.trim().length > 5;

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setPresentation(null);

    try {
      const res = await fetch("/api/generate-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? json?.error ?? "Failed to generate presentation.");
      }

      const data = json as GeneratePresentationResponse;
      setPresentation({ presentationId: data.presentation_id, data: data.data });
      setHistory((prev) => [
        {
          id: String(data.presentation_id),
          property_address: data.data?.property?.address ?? address.trim(),
          created_at: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error generating presentation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Share link copied!");
    } catch {
      // Fallback: prompt manual copy.
      window.prompt("Copy this share link:", shareUrl);
    }
  };

  const handleDownloadPdf = async () => {
    if (!presentation) return;
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF();

      let y = 10;
      doc.setFontSize(16);
      doc.text("Listing Presentation", 10, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Address: ${presentation.data.property.address}`, 12, y);
      y += 6;
      doc.text(
        `${presentation.data.property.beds ?? "—"} beds • ${presentation.data.property.baths ?? "—"} baths • ${
          presentation.data.property.sqft ? Number(presentation.data.property.sqft).toLocaleString() : "—"
        } sqft`,
        12,
        y
      );
      y += 7;

      doc.setFontSize(12);
      doc.text("Estimated Value", 10, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(`Point estimate: ${formatCurrency(presentation.data.estimate.estimatedValue)}`, 12, y);
      y += 5;
      doc.text(
        `Range: ${formatCurrency(presentation.data.estimate.low)} – ${formatCurrency(presentation.data.estimate.high)}`,
        12,
        y
      );
      y += 7;

      doc.setFontSize(12);
      doc.text("Nearby Comparable Sales", 10, y);
      y += 6;
      doc.setFontSize(10);

      const compsToShow = presentation.data.comps.slice(0, 6);
      if (compsToShow.length === 0) {
        doc.text("No comparable sales available yet.", 12, y);
        y += 6;
      } else {
        compsToShow.forEach((c, idx) => {
          const line = `${idx + 1}. ${c.address} — $${Math.round(c.price).toLocaleString()} (${c.soldDate})`;
          const lines = doc.splitTextToSize(line, 185);
          lines.forEach((ln: string) => {
            doc.text(ln, 12, y);
            y += 5;
            if (y > 275) {
              doc.addPage();
              y = 10;
            }
          });
        });
      }

      y += 5;
      doc.setFontSize(12);
      doc.text("Pricing Strategy (AI)", 10, y);
      y += 6;
      doc.setFontSize(10);
      const strategyLines = doc.splitTextToSize(presentation.data.pricing_strategy, 190);
      strategyLines.forEach((ln: string) => {
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
        doc.text(ln, 12, y);
        y += 5;
      });

      doc.addPage();
      y = 10;
      doc.setFontSize(12);
      doc.text("Market Insights (AI)", 10, y);
      y += 6;
      const insightsLines = doc.splitTextToSize(presentation.data.market_insights, 190);
      insightsLines.forEach((ln: string) => {
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
        doc.text(ln, 12, y);
        y += 5;
      });

      doc.addPage();
      y = 10;
      doc.setFontSize(12);
      doc.text("Marketing Plan (AI)", 10, y);
      y += 6;
      const planLines = doc.splitTextToSize(presentation.data.marketing_plan, 190);
      planLines.forEach((ln: string) => {
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
        doc.text(ln, 12, y);
        y += 5;
      });

      doc.save("listing-presentation.pdf");
    } catch (err) {
      console.error(err);
      alert(
        "There was an issue generating the PDF. Make sure 'jspdf' is installed, then try again."
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="ui-page-title text-brand-text">Seller Presentation Generator</h1>
          <p className="ui-page-subtitle text-brand-text/80">
            Create a professional listing presentation (CMA + strategy + marketing plan) from an address.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="space-y-2">
          <div className="ui-card-subtitle text-slate-700">
            Property Address
          </div>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            placeholder="Enter property address"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          className="w-full inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white hover:bg-[#005ca8] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? "Generating..." : "Generate Presentation"}
        </button>
      </div>

      {presentation ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <div className="ui-card-subtitle text-slate-500">
                Preview
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {presentation.data.property.address}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                Download PDF
              </button>
              <button
                onClick={handleCopyShareLink}
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                Share Link
              </button>
              {shareUrl ? (
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#005ca8]"
                >
                  Open Share Page
                </a>
              ) : null}
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-brand-surface border border-gray-200 rounded-xl p-4">
                <div className="ui-card-subtitle text-slate-500">
                  Point Estimate
                </div>
                <div className="text-3xl font-extrabold text-brand-primary mt-2">
                  {formatCurrency(presentation.data.estimate.estimatedValue)}
                </div>
              </div>
              <div className="bg-brand-surface border border-gray-200 rounded-xl p-4">
                <div className="ui-card-subtitle text-slate-500">
                  Range
                </div>
                <div className="text-lg font-bold text-slate-900 mt-2">
                  {formatCurrency(presentation.data.estimate.low)} – {formatCurrency(presentation.data.estimate.high)}
                </div>
              </div>
              <div className="bg-brand-surface border border-gray-200 rounded-xl p-4">
                <div className="ui-card-subtitle text-slate-500">
                  Snapshot
                </div>
                <div className="text-sm text-slate-800 font-semibold mt-2">
                  {presentation.data.property.beds ?? "—"} Beds • {presentation.data.property.baths ?? "—"} Baths •{" "}
                  {presentation.data.property.sqft ? Number(presentation.data.property.sqft).toLocaleString() : "—"} Sqft
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="ui-card-title text-slate-900">Nearby Comparable Sales</div>
              <div className="text-xs text-slate-600 mt-1">
                Based on recent nearby comparable sold properties.
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="ui-table-header px-3 py-2">Address</th>
                      <th className="ui-table-header px-3 py-2">Sold</th>
                      <th className="ui-table-header px-3 py-2">Sqft</th>
                      <th className="ui-table-header px-3 py-2">Price/Sqft</th>
                      <th className="ui-table-header px-3 py-2">Sold Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentation.data.comps.slice(0, 8).map((c, idx) => (
                      <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="ui-table-cell px-3 py-2 whitespace-nowrap">{c.address}</td>
                        <td className="ui-table-cell px-3 py-2">{`$${Math.round(c.price).toLocaleString()}`}</td>
                        <td className="ui-table-cell px-3 py-2">{c.sqft ? Number(c.sqft).toLocaleString() : "—"}</td>
                        <td className="ui-table-cell px-3 py-2">
                          {Number.isFinite(c.pricePerSqft) ? `$${c.pricePerSqft.toFixed(0)}` : "—"}
                        </td>
                        <td className="ui-table-cell px-3 py-2">{c.soldDate || "—"}</td>
                      </tr>
                    ))}
                    {presentation.data.comps.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-sm text-slate-600">
                          No comparable sold data available yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 md:col-span-1 space-y-2">
                <div className="ui-card-title text-slate-900">Pricing Strategy</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {presentation.data.pricing_strategy || "—"}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 md:col-span-1 space-y-2">
                <div className="ui-card-title text-slate-900">Market Insights</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {presentation.data.market_insights || "—"}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 md:col-span-1 space-y-2">
                <div className="ui-card-title text-slate-900">Marketing Plan</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {presentation.data.marketing_plan || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <div className="ui-card-title text-brand-text">Recent Presentations</div>
            <div className="text-xs text-slate-600 mt-1">
              Open a past presentation to preview, download, or copy the share link.
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="ui-table-header text-left px-3 py-3">Property</th>
                <th className="ui-table-header text-left px-3 py-3">Created</th>
                <th className="ui-table-header text-left px-3 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="ui-table-cell px-3 py-3">
                      <div className="ui-card-title text-slate-900">
                        {p.property_address ?? "—"}
                      </div>
                    </td>
                    <td className="ui-table-cell px-3 py-3 text-slate-600 whitespace-nowrap">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/presentation/${encodeURIComponent(p.id)}`}
                        className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-[#005ca8]"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-sm text-slate-600">
                    No presentations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

