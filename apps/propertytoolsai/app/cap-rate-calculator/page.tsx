"use client";

import { useEffect, useMemo, useState } from "react";
import { trackCapRateUsed } from "@/lib/tracking";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import JsonLd from "../../components/JsonLd";
import { ToolLeadGate } from "@/components/ToolLeadGate";
import { SaveResultsButton } from "@/components/SaveResultsButton";

/**
 * Cap rate calculator — primary. An optional "Include financing"
 * toggle reveals down-payment / rate / term inputs and adds CoC ROI
 * output. This subsumes the retired /cap-rate-roi-calculator page,
 * which is now 301'd here.
 */

function pmt(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function CapRateCalculator() {
  const [purchasePrice, setPurchasePrice] = useState<number>(400000);
  const [annualRent, setAnnualRent] = useState<number>(28800);
  const [vacancyRate, setVacancyRate] = useState<number>(5);
  const [propertyTax, setPropertyTax] = useState<number>(4800);
  const [insurance, setInsurance] = useState<number>(1200);
  const [maintenance, setMaintenance] = useState<number>(2400);
  const [otherExpenses, setOtherExpenses] = useState<number>(1200);

  // Optional financing section
  const [includeFinancing, setIncludeFinancing] = useState<boolean>(false);
  const [downPayment, setDownPayment] = useState<number>(80000);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [loanTerm, setLoanTerm] = useState<number>(30);

  useEffect(() => {
    void trackCapRateUsed({ phase: "page_view", purchasePrice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const effectiveIncome = annualRent * (1 - vacancyRate / 100);
    const operatingExpenses = propertyTax + insurance + maintenance + otherExpenses;
    const noi = effectiveIncome - operatingExpenses;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;

    // CoC ROI — requires financing inputs. Uses the first-year simple
    // method: (NOI − annual debt service) / cash invested.
    let annualDebtService = 0;
    let cashInvested = 0;
    let cashOnCashRoi: number | null = null;
    if (includeFinancing) {
      const loanAmount = Math.max(0, purchasePrice - downPayment);
      const monthlyPayment = pmt(loanAmount, interestRate, loanTerm);
      annualDebtService = monthlyPayment * 12;
      cashInvested = downPayment;
      cashOnCashRoi =
        cashInvested > 0 ? ((noi - annualDebtService) / cashInvested) * 100 : 0;
    }

    return {
      noi,
      capRate,
      effectiveIncome,
      operatingExpenses,
      annualDebtService,
      cashInvested,
      cashOnCashRoi,
    };
  }, [
    purchasePrice,
    annualRent,
    vacancyRate,
    propertyTax,
    insurance,
    maintenance,
    otherExpenses,
    includeFinancing,
    downPayment,
    interestRate,
    loanTerm,
  ]);

  return (
    <div className="w-full max-w-6xl py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Cap Rate Calculator",
          applicationCategory: "FinanceApplication",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/cap-rate-calculator",
          description:
            "Calculate cap rate and optional cash-on-cash ROI for rental property investments.",
        }}
      />
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium mb-6"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Cap Rate Calculator</h1>
      <p className="text-gray-600 mb-8">
        Calculate cap rate from NOI and purchase price. Toggle on financing to also see cash-on-cash ROI.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Property & income</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Purchase price ($)" value={purchasePrice} onChange={setPurchasePrice} min={1000} />
              <InputField label="Annual rent ($)" value={annualRent} onChange={setAnnualRent} min={0} />
              <InputField label="Vacancy rate (%)" value={vacancyRate} onChange={setVacancyRate} min={0} max={50} step={1} />
              <InputField label="Property tax ($/yr)" value={propertyTax} onChange={setPropertyTax} min={0} />
              <InputField label="Insurance ($/yr)" value={insurance} onChange={setInsurance} min={0} />
              <InputField label="Maintenance ($/yr)" value={maintenance} onChange={setMaintenance} min={0} />
              <InputField label="Other expenses ($/yr)" value={otherExpenses} onChange={setOtherExpenses} min={0} />
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeFinancing}
                  onChange={(e) => setIncludeFinancing(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-800">
                  Include financing (show cash-on-cash ROI)
                </span>
              </label>
              <p className="mt-1 text-[11px] text-slate-500">
                Adds down-payment / rate / term inputs. Cap rate is leverage-agnostic; CoC ROI shows your actual first-year return on cash invested.
              </p>
              {includeFinancing ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InputField label="Down payment ($)" value={downPayment} onChange={setDownPayment} min={0} />
                  <InputField label="Interest rate (%)" value={interestRate} onChange={setInterestRate} min={0} max={20} step={0.1} />
                  <InputField label="Loan term (yrs)" value={loanTerm} onChange={setLoanTerm} min={5} max={40} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title={includeFinancing ? "Cap rate & CoC ROI" : "Cap rate"}
              value={`${results.capRate.toFixed(2)}%`}
              details={[
                `NOI: $${results.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `Effective income: $${results.effectiveIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `Operating expenses: $${results.operatingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `Cap rate: ${results.capRate.toFixed(2)}%`,
                ...(includeFinancing && results.cashOnCashRoi != null
                  ? [
                      `Annual debt service: $${results.annualDebtService.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      `Cash invested: $${results.cashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      `Cash-on-cash ROI (year 1): ${results.cashOnCashRoi.toFixed(2)}%`,
                    ]
                  : []),
              ].join("\n")}
            />
          </div>
        </div>
      </div>

      {results.capRate !== 0 ? (
        <div className="mt-6">
          <SaveResultsButton
            tool="cap_rate_calculator"
            inputs={{
              purchasePrice,
              annualRent,
              vacancyRate,
              propertyTax,
              insurance,
              maintenance,
              otherExpenses,
              ...(includeFinancing
                ? { downPayment, interestRate, loanTerm, includeFinancing }
                : {}),
            }}
            results={results}
          />
        </div>
      ) : null}

      <div className="mt-8">
        <ToolLeadGate
          tool="cap_rate_calculator"
          source="cap_rate"
          intent="invest"
          show={true}
          title="Get Your Cap Rate Analysis"
          description="Unlock market comparison and investment grade analysis."
          benefits={[
            "Market cap rate comparison",
            "NOI optimization tips",
            "Investment grade rating",
            "Connect with an investment expert",
          ]}
        />
      </div>

      <section className="mt-12 max-w-3xl space-y-3 text-sm text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">
          What is a good cap rate?
        </h2>
        <p>
          The cap rate calculator converts net operating income (NOI) and purchase price
          into a capitalization rate, a core metric for comparing rental investments. It
          adjusts for vacancy and common operating expenses to approximate stabilized
          NOI.
        </p>
        <p>
          Investors and brokers can use this tool to benchmark properties against local
          market cap rates and risk profiles. Higher cap rates often indicate more risk
          and potentially higher returns, while lower cap rates are typical in premium,
          supply-constrained locations.
        </p>
      </section>

      <section className="mt-16 max-w-4xl space-y-6 text-sm text-gray-700 text-left">
        <h2 className="text-2xl font-semibold text-gray-900">
          People also ask about cap rate
        </h2>

        <article className="space-y-2">
          <h3 className="text-lg font-semibold">
            What is cap rate and why is it important?
          </h3>
          <p className="text-gray-600">
            Cap rate, or capitalization rate, is a ratio of a property&apos;s net operating income
            to its purchase price or value, expressed as a percentage.
            It is important because it helps investors quickly compare the income potential and
            risk profile of different properties. You can calculate it instantly with this{" "}
            <Link href="/cap-rate-calculator" className="text-blue-600 underline">
              Cap Rate Calculator
            </Link>
            .
          </p>
        </article>

        <article className="space-y-2">
          <h3 className="text-lg font-semibold">
            How do I calculate net operating income (NOI) for cap rate?
          </h3>
          <p className="text-gray-600">
            To calculate NOI, subtract all reasonable operating expenses—such as taxes, insurance,
            maintenance, and management—from your effective rental income, but do not subtract
            mortgage payments.
            This calculator helps you estimate NOI and cap rate at the same time, and you can
            analyze detailed cash flow with our{" "}
            <Link href="/cash-flow-calculator" className="text-blue-600 underline">
              Cash Flow Calculator
            </Link>
            .
          </p>
        </article>

        <article className="space-y-2">
          <h3 className="text-lg font-semibold">
            Is a higher cap rate always better for investors?
          </h3>
          <p className="text-gray-600">
            A higher cap rate is not always better, because it often reflects higher risk, weaker
            locations, or more intensive management.
            Lower cap rates are typical in strong, supply-constrained markets where investors are
            willing to accept lower yields for more stability.
          </p>
        </article>

        <article className="space-y-2">
          <h3 className="text-lg font-semibold">
            How does financing affect cap rate and my real return?
          </h3>
          <p className="text-gray-600">
            Traditional cap rate calculations ignore financing and are based only on NOI and
            purchase price, but your real return also depends on your loan terms and cash invested.
            Turn on &quot;Include financing&quot; above to see cash-on-cash ROI alongside cap rate, or
            use our{" "}
            <Link href="/roi-calculator" className="text-blue-600 underline">
              ROI Calculator
            </Link>{" "}
            for multi-year projections with appreciation.
          </p>
        </article>

        <article className="space-y-2">
          <h3 className="text-lg font-semibold">
            What is a good cap rate for my market?
          </h3>
          <p className="text-gray-600">
            A &quot;good&quot; cap rate depends on your market, asset type, and risk tolerance—core
            properties in top-tier markets often trade at lower cap rates, while value-add deals in
            secondary markets show higher caps.
            Use this calculator to evaluate individual properties and compare them to recent sales
            or broker guidance. Then check projected cash flow with our{" "}
            <Link href="/cash-flow-calculator" className="text-blue-600 underline">
              Cash Flow Calculator
            </Link>
            .
          </p>
        </article>

        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-4">Related Calculators</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/cash-flow-calculator" className="text-blue-600 underline">
              Cash Flow Calculator
            </Link>
            <Link href="/roi-calculator" className="text-blue-600 underline">
              ROI Calculator
            </Link>
            <Link href="/rental-property-analyzer" className="text-blue-600 underline">
              Rental Property Analyzer
            </Link>
            <Link href="/mortgage-calculator" className="text-blue-600 underline">
              Mortgage Calculator
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
