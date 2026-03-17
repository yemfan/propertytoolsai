"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import JsonLd from "../../components/JsonLd";

export default function AiRealEstateDealAnalyzer() {
  const [purchasePrice, setPurchasePrice] = useState<number>(350000);
  const [monthlyRent, setMonthlyRent] = useState<number>(2600);
  const [otherIncome, setOtherIncome] = useState<number>(0);
  const [vacancyRate, setVacancyRate] = useState<number>(5);

  const [taxes, setTaxes] = useState<number>(4800);
  const [insurance, setInsurance] = useState<number>(1400);
  const [maintenance, setMaintenance] = useState<number>(150);
  const [utilities, setUtilities] = useState<number>(0);
  const [managementPercent, setManagementPercent] = useState<number>(8);
  const [hoa, setHoa] = useState<number>(0);

  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [interestRate, setInterestRate] = useState<number>(6);
  const [loanTermYears, setLoanTermYears] = useState<number>(30);
  const [closingCosts, setClosingCosts] = useState<number>(5000);
  const [initialCapex, setInitialCapex] = useState<number>(0);

  const results = useMemo(() => {
    const downPayment = (purchasePrice * downPaymentPercent) / 100;
    const loanAmount = Math.max(purchasePrice - downPayment, 0);

    const monthlyInterestRate = interestRate > 0 ? interestRate / 100 / 12 : 0;
    const numberOfPayments = loanTermYears * 12;

    const monthlyMortgage =
      loanAmount > 0 && monthlyInterestRate > 0
        ? (loanAmount *
            monthlyInterestRate *
            Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
          (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
        : loanAmount > 0
        ? loanAmount / numberOfPayments
        : 0;

    const monthlyGrossIncome = monthlyRent + otherIncome;
    const monthlyVacancyLoss = (monthlyGrossIncome * vacancyRate) / 100;
    const monthlyEffectiveIncome = monthlyGrossIncome - monthlyVacancyLoss;

    const monthlyTaxes = taxes / 12;
    const monthlyInsurance = insurance / 12;
    const monthlyManagement = (monthlyEffectiveIncome * managementPercent) / 100;

    const monthlyOperatingExpenses =
      monthlyTaxes +
      monthlyInsurance +
      maintenance +
      utilities +
      monthlyManagement +
      hoa;

    const monthlyNOI = monthlyEffectiveIncome - monthlyOperatingExpenses;
    const annualNOI = monthlyNOI * 12;

    const monthlyCashFlow = monthlyNOI - monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;

    const totalCashInvested = downPayment + closingCosts + initialCapex;
    const cashOnCashReturn =
      totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
    const capRate =
      purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

    let dealScore = 50;
    if (capRate > 0) {
      dealScore += Math.min(capRate * 2, 30);
    }
    if (cashOnCashReturn > 0) {
      dealScore += Math.min(cashOnCashReturn, 20);
    }
    if (monthlyCashFlow < 0) {
      dealScore -= 15;
    }
    dealScore = Math.max(0, Math.min(100, dealScore));

    let dealLabel = "Average deal";
    let scoreColor = "bg-amber-50 text-amber-800 border-amber-200";
    if (dealScore >= 80) {
      dealLabel = "Good deal";
      scoreColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
    } else if (dealScore < 60) {
      dealLabel = "Risky deal";
      scoreColor = "bg-rose-50 text-rose-800 border-rose-200";
    }

    return {
      downPayment,
      loanAmount,
      monthlyMortgage,
      monthlyNOI,
      annualNOI,
      monthlyCashFlow,
      annualCashFlow,
      totalCashInvested,
      cashOnCashReturn,
      capRate,
      dealScore,
      dealLabel,
      scoreColor,
    };
  }, [
    purchasePrice,
    monthlyRent,
    otherIncome,
    vacancyRate,
    taxes,
    insurance,
    maintenance,
    utilities,
    managementPercent,
    hoa,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    closingCosts,
    initialCapex,
  ]);

  return (
    <div className="container mx-auto px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "AI Real Estate Deal Analyzer",
          applicationCategory: "FinanceApplication",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          url: "https://propertytoolsai.com/ai-real-estate-deal-analyzer",
          description:
            "Analyze rental property deals with AI-assisted metrics including cap rate, cash flow, cash-on-cash return, and net operating income.",
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">
        AI Real Estate Deal Analyzer
      </h1>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Enter your property details, investment inputs, and operating assumptions on the left.
        On the right, see an AI-style deal score, key investment metrics, and a concise analysis
        of how the deal performs based on your numbers.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] gap-8 items-start">
        <div className="space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Property details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Purchase price ($)"
                value={purchasePrice}
                onChange={setPurchasePrice}
                min={10000}
              />
              <InputField
                label="Monthly rent ($)"
                value={monthlyRent}
                onChange={setMonthlyRent}
                min={0}
              />
              <InputField
                label="Other monthly income ($)"
                value={otherIncome}
                onChange={setOtherIncome}
                min={0}
              />
              <InputField
                label="Vacancy rate (%)"
                value={vacancyRate}
                onChange={setVacancyRate}
                min={0}
                max={30}
              />
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Investment inputs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Down payment (%)"
                value={downPaymentPercent}
                onChange={setDownPaymentPercent}
                min={0}
                max={100}
              />
              <InputField
                label="Interest rate (%)"
                value={interestRate}
                onChange={setInterestRate}
                min={0}
                max={20}
              />
              <InputField
                label="Loan term (years)"
                value={loanTermYears}
                onChange={setLoanTermYears}
                min={5}
                max={40}
              />
              <InputField
                label="Closing costs ($)"
                value={closingCosts}
                onChange={setClosingCosts}
                min={0}
              />
              <InputField
                label="Initial repairs / CapEx ($)"
                value={initialCapex}
                onChange={setInitialCapex}
                min={0}
              />
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Operating assumptions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Annual property taxes ($)"
                value={taxes}
                onChange={setTaxes}
                min={0}
              />
              <InputField
                label="Annual insurance ($)"
                value={insurance}
                onChange={setInsurance}
                min={0}
              />
              <InputField
                label="Monthly maintenance & repairs ($)"
                value={maintenance}
                onChange={setMaintenance}
                min={0}
              />
              <InputField
                label="Monthly utilities (landlord-paid) ($)"
                value={utilities}
                onChange={setUtilities}
                min={0}
              />
              <InputField
                label="Management fee (%)"
                value={managementPercent}
                onChange={setManagementPercent}
                min={0}
                max={20}
              />
              <InputField
                label="Monthly HOA dues ($)"
                value={hoa}
                onChange={setHoa}
                min={0}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div
            className={`border rounded-xl p-6 shadow-sm ${results.scoreColor}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  AI Deal Score
                </h2>
                <p className="mt-1 text-xs opacity-80">
                  Based on cap rate, cash flow, and cash-on-cash return.
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-current">
                {results.dealLabel}
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-bold">
                {results.dealScore.toFixed(0)}
              </span>
              <span className="text-sm font-medium opacity-80">/ 100</span>
            </div>
            <p className="mt-4 text-xs opacity-80">
              This score is a heuristic guide, not investment advice. Adjust your assumptions to see
              how financing, expenses, and rents change the strength of the deal.
            </p>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Key investment metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ResultCard
                title="Cap Rate"
                value={`${results.capRate.toFixed(2)}%`}
                details="Year 1 cap rate based on NOI and purchase price."
              />
              <ResultCard
                title="Monthly Cash Flow"
                value={`$${results.monthlyCashFlow.toFixed(0)}`}
                details={`After operating expenses and mortgage.\nAnnual: $${results.annualCashFlow.toFixed(
                  0
                )}`}
              />
              <ResultCard
                title="Cash on Cash Return"
                value={`${results.cashOnCashReturn.toFixed(2)}%`}
                details={`Year 1 return on total cash invested ($${results.totalCashInvested.toFixed(
                  0
                )}).`}
              />
              <ResultCard
                title="Net Operating Income"
                value={`$${results.annualNOI.toFixed(0)}/yr`}
                details={`Monthly NOI: $${results.monthlyNOI.toFixed(0)}`}
              />
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6 space-y-3 text-sm text-gray-700">
            <h2 className="text-lg font-semibold text-gray-900">
              AI investment analysis
            </h2>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Summary based on your current assumptions
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                With a cap rate of{" "}
                <span className="font-semibold">
                  {results.capRate.toFixed(2)}%
                </span>
                , this deal offers{" "}
                <span className="font-semibold">
                  {results.capRate >= 6 ? "above-average" : "modest"}
                </span>{" "}
                income yield for many rental markets.
              </li>
              <li>
                Monthly cash flow of{" "}
                <span className="font-semibold">
                  ${results.monthlyCashFlow.toFixed(0)}
                </span>{" "}
                suggests{" "}
                <span className="font-semibold">
                  {results.monthlyCashFlow >= 0
                    ? "positive carry after financing"
                    : "a potential negative carry"}
                </span>{" "}
                under your current assumptions.
              </li>
              <li>
                A cash-on-cash return of{" "}
                <span className="font-semibold">
                  {results.cashOnCashReturn.toFixed(1)}%
                </span>{" "}
                on{" "}
                <span className="font-semibold">
                  ${results.totalCashInvested.toFixed(0)}
                </span>{" "}
                of invested cash helps you compare this deal to other opportunities.
              </li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              For deeper modeling of rent growth, exit assumptions, and long-term ROI, pair this
              analyzer with the{" "}
              <Link href="/property-investment-analyzer" className="text-blue-600 underline">
                Property Investment Analyzer
              </Link>{" "}
              and{" "}
              <Link href="/roi-calculator" className="text-blue-600 underline">
                ROI Calculator
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

