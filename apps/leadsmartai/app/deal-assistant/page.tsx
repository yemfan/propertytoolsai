"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import RequireAuthGate from "@/components/RequireAuthGate";

type MarketHeat = "hot" | "balanced" | "cool";
type Financing = "cash" | "conventional" | "fha" | "va" | "other";

type ApiStrategy = {
  recommendedPrice: number;
  strategy: string;
  confidence: number;
  reasoning: string;
};

type ApiRisk = {
  level: string;
  score: number;
  notes: string;
};

type ApiNegotiation = {
  scenario: string;
  suggestedScript: string;
  talkingPoints: string[];
  pitfalls: string[];
};

type AnalyzeResponse = {
  ok: boolean;
  strategy?: ApiStrategy;
  risks?: { overpay: ApiRisk; appraisal: ApiRisk; market: ApiRisk };
  offerTerms?: {
    purchasePrice: number;
    earnestMoney: number;
    dueDiligenceDays: number;
    financingType: string;
    contingencies: string[];
    closingTimelineDays: number;
    optionalRequests: string[];
    coverLetterBullets: string[];
  };
  negotiation?: Record<string, ApiNegotiation>;
  message?: string;
};

const initialForm = {
  propertyAddress: "",
  notes: "",
  listPrice: "",
  budgetMax: "",
  comparablesMedian: "",
  daysOnMarket: "14",
  marketHeat: "balanced" as MarketHeat,
  competingOfferCount: "",
  financingType: "conventional" as Financing,
  closingTimelineDays: "30",
  earnestMoneyPercent: "1",
  inspectionContingency: true,
  appraisalContingency: true,
  financingContingency: true,
  sellerConcessionPercent: "",
  extras: "",
};

function RiskCard({ title, r }: { title: string; r: ApiRisk }) {
  const color =
    r.level === "low"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : r.level === "medium"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-rose-50 border-rose-200 text-rose-900";
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs font-bold uppercase">{r.level}</div>
      </div>
      <div className="text-xs text-slate-600 mb-2">Score {r.score}/100 (higher = more risk)</div>
      <p className="text-sm leading-relaxed">{r.notes}</p>
    </div>
  );
}

export default function DealAssistantPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [negTab, setNegTab] = useState<"counter_offer" | "multiple_offers" | "seller_pushback">(
    "counter_offer"
  );

  const negLabels = useMemo(
    () =>
      ({
        counter_offer: "Counter offer",
        multiple_offers: "Multiple offers",
        seller_pushback: "Seller pushback",
      }) as const,
    []
  );

  async function runAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/deal-assistant/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: form.propertyAddress || undefined,
          notes: form.notes || undefined,
          listPrice: Number(form.listPrice),
          budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
          comparablesMedian: form.comparablesMedian ? Number(form.comparablesMedian) : undefined,
          daysOnMarket: Number(form.daysOnMarket) || 0,
          marketHeat: form.marketHeat,
          competingOfferCount: form.competingOfferCount
            ? Number(form.competingOfferCount)
            : undefined,
          financingType: form.financingType,
          closingTimelineDays: Number(form.closingTimelineDays) || 30,
          earnestMoneyPercent: Number(form.earnestMoneyPercent) || 1,
          inspectionContingency: form.inspectionContingency,
          appraisalContingency: form.appraisalContingency,
          financingContingency: form.financingContingency,
          sellerConcessionPercent: form.sellerConcessionPercent
            ? Number(form.sellerConcessionPercent)
            : undefined,
          extras: form.extras || undefined,
        }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      setResult(data);
    } catch {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const neg = result?.negotiation?.[negTab];

  return (
    <RequireAuthGate>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
          <div>
            <Link
              href="/dashboard/tools"
              className="text-sm font-medium text-blue-700 hover:text-blue-900 mb-4 inline-block"
            >
              ← Back to Tools
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">AI Deal Closer</h1>
            <p className="mt-2 text-slate-600 max-w-2xl">
              Offer strategy, structured terms, risk flags, and negotiation scripts — powered by your inputs
              and OpenAI when <code className="text-xs bg-slate-200 px-1 rounded">OPENAI_API_KEY</code> is set.
            </p>
          </div>

          <form
            onSubmit={runAnalyze}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Property address
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.propertyAddress}
                  onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))}
                  placeholder="123 Main St, City, ST"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  List price *
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.listPrice}
                  onChange={(e) => setForm((f) => ({ ...f, listPrice: e.target.value }))}
                  placeholder="850000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Buyer max budget
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.budgetMax}
                  onChange={(e) => setForm((f) => ({ ...f, budgetMax: e.target.value }))}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Comp median (closed)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.comparablesMedian}
                  onChange={(e) => setForm((f) => ({ ...f, comparablesMedian: e.target.value }))}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Days on market
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.daysOnMarket}
                  onChange={(e) => setForm((f) => ({ ...f, daysOnMarket: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Market heat
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.marketHeat}
                  onChange={(e) => setForm((f) => ({ ...f, marketHeat: e.target.value as MarketHeat }))}
                >
                  <option value="hot">Hot</option>
                  <option value="balanced">Balanced</option>
                  <option value="cool">Cool</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Known competing offers
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.competingOfferCount}
                  onChange={(e) => setForm((f) => ({ ...f, competingOfferCount: e.target.value }))}
                  placeholder="0 if unknown"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Financing
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.financingType}
                  onChange={(e) => setForm((f) => ({ ...f, financingType: e.target.value as Financing }))}
                >
                  <option value="conventional">Conventional</option>
                  <option value="fha">FHA</option>
                  <option value="va">VA</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Target close (days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={120}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.closingTimelineDays}
                  onChange={(e) => setForm((f) => ({ ...f, closingTimelineDays: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Earnest money (% of price)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min={0.25}
                  max={10}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.earnestMoneyPercent}
                  onChange={(e) => setForm((f) => ({ ...f, earnestMoneyPercent: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Seller concessions (%)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  max={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.sellerConcessionPercent}
                  onChange={(e) => setForm((f) => ({ ...f, sellerConcessionPercent: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.inspectionContingency}
                  onChange={(e) => setForm((f) => ({ ...f, inspectionContingency: e.target.checked }))}
                />
                Inspection contingency
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.appraisalContingency}
                  onChange={(e) => setForm((f) => ({ ...f, appraisalContingency: e.target.checked }))}
                />
                Appraisal contingency
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.financingContingency}
                  onChange={(e) => setForm((f) => ({ ...f, financingContingency: e.target.checked }))}
                />
                Financing contingency
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Notes (buyer situation, seller cues)
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px]"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. relocation, must close by June, seller wants rent-back…"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Optional requests (personal property, etc.)
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.extras}
                onChange={(e) => setForm((f) => ({ ...f, extras: e.target.value }))}
                placeholder="Fridge, early occupancy, …"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Analyzing…" : "Generate deal plan"}
            </button>
          </form>

          {result && !result.ok && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-900 px-4 py-3 text-sm">
              {result.message || "Something went wrong"}
            </div>
          )}

          {result?.ok && result.strategy && result.risks && (
            <>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Offer recommendation</h2>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
                  <div className="flex flex-wrap gap-4 items-baseline">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase">Recommended first offer</div>
                      <div className="text-3xl font-bold text-slate-900">
                        ${result.strategy.recommendedPrice.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase">Posture</div>
                      <div className="text-lg font-semibold capitalize text-blue-800">
                        {result.strategy.strategy}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase">Confidence</div>
                      <div className="text-lg font-semibold text-slate-800">
                        {result.strategy.confidence}%
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {result.strategy.reasoning}
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Risk analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <RiskCard title="Overpay risk" r={result.risks.overpay} />
                  <RiskCard title="Appraisal risk" r={result.risks.appraisal} />
                  <RiskCard title="Market / liquidity" r={result.risks.market} />
                </div>
              </section>

              {result.offerTerms && (
                <section className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900">Structured offer terms</h2>
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500">Price:</span>{" "}
                        <span className="font-semibold">
                          ${result.offerTerms.purchasePrice.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Earnest money:</span>{" "}
                        <span className="font-semibold">
                          ${result.offerTerms.earnestMoney.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Financing:</span>{" "}
                        <span className="font-semibold">{result.offerTerms.financingType}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Closing target:</span>{" "}
                        <span className="font-semibold">{result.offerTerms.closingTimelineDays} days</span>
                      </div>
                    </div>
                    {result.offerTerms.contingencies.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                          Contingencies
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                          {result.offerTerms.contingencies.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.offerTerms.optionalRequests.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                          Optional requests
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                          {result.offerTerms.optionalRequests.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                        Cover letter bullets
                      </div>
                      <ul className="list-disc pl-5 space-y-2 text-slate-700">
                        {result.offerTerms.coverLetterBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-4 pb-12">
                <h2 className="text-xl font-bold text-slate-900">Negotiation suggestions</h2>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(negLabels) as (keyof typeof negLabels)[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNegTab(k)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                        negTab === k
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {negLabels[k]}
                    </button>
                  ))}
                </div>
                {neg && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                        Suggested script
                      </div>
                      <p className="text-slate-800 leading-relaxed italic border-l-4 border-blue-200 pl-4">
                        {neg.suggestedScript}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                        Talking points
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-slate-700">
                        {neg.talkingPoints.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Pitfalls</div>
                      <ul className="list-disc pl-5 space-y-1 text-rose-800">
                        {neg.pitfalls.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </RequireAuthGate>
  );
}
