"use client";

import { useMemo } from "react";

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

export default function PresentationPublicClient({
  presentationId,
  data,
}: {
  presentationId: string;
  data: PresentationData;
}) {
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/presentation/${encodeURIComponent(
      presentationId
    )}`;
  }, [presentationId]);

  const formatCurrency = (value: number | null) =>
    value == null || !Number.isFinite(value)
      ? "—"
      : `$${Math.round(value).toLocaleString()}`;

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied!");
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF();

      let y = 10;
      doc.setFontSize(16);
      doc.text("Listing Presentation", 10, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Address: ${data.property.address}`, 12, y);
      y += 6;
      doc.text(
        `${data.property.beds ?? "—"} beds • ${data.property.baths ?? "—"} baths • ${
          data.property.sqft ? Number(data.property.sqft).toLocaleString() : "—"
        } sqft`,
        12,
        y
      );
      y += 7;

      doc.setFontSize(12);
      doc.text("Estimated Value", 10, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(`Point estimate: ${formatCurrency(data.estimate.estimatedValue)}`, 12, y);
      y += 5;
      doc.text(
        `Range: ${formatCurrency(data.estimate.low)} – ${formatCurrency(data.estimate.high)}`,
        12,
        y
      );
      y += 8;

      doc.setFontSize(12);
      doc.text("Pricing Strategy (AI)", 10, y);
      y += 6;
      doc.setFontSize(10);
      const strategyLines = doc.splitTextToSize(data.pricing_strategy || "", 190);
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
      const insightLines = doc.splitTextToSize(data.market_insights || "", 190);
      insightLines.forEach((ln: string) => {
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
      const planLines = doc.splitTextToSize(data.marketing_plan || "", 190);
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Seller Listing Presentation
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {data.property.address}
              </div>
              <div className="text-sm text-slate-600 mt-2">
                Estimated range:{" "}
                {formatCurrency(data.estimate.low)} – {formatCurrency(data.estimate.high)}
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
                Copy Link
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Point Estimate
              </div>
              <div className="text-3xl font-extrabold text-blue-700 mt-2">
                {formatCurrency(data.estimate.estimatedValue)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Beds/Baths
              </div>
              <div className="text-sm text-slate-800 font-semibold mt-2">
                {data.property.beds ?? "—"} Beds • {data.property.baths ?? "—"} Baths
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sqft
              </div>
              <div className="text-sm text-slate-800 font-semibold mt-2">
                {data.property.sqft ? Number(data.property.sqft).toLocaleString() : "—"} Sqft
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Nearby Comparable Sales</div>
            <div className="text-xs text-slate-600 mt-1">
              Based on recent nearby sold comps.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Address</th>
                  <th className="px-3 py-2 font-semibold">Sold</th>
                  <th className="px-3 py-2 font-semibold">Sold Date</th>
                </tr>
              </thead>
              <tbody>
                {data.comps.length ? (
                  data.comps.slice(0, 8).map((c, idx) => (
                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{c.address}</td>
                      <td className="px-3 py-2">{`$${Math.round(c.price).toLocaleString()}`}</td>
                      <td className="px-3 py-2">{c.soldDate || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-sm text-slate-600">
                      No comparable sold data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Pricing Strategy</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {data.pricing_strategy || "—"}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Market Insights</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {data.market_insights || "—"}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Marketing Plan</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {data.marketing_plan || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

