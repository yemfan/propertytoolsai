"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import ToolLinks from "../../components/ToolLinks";

function pmt(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function PropertyInvestmentAnalyzer() {
  const [purchasePrice, setPurchasePrice] = useState<number>(300000);
  const [downPayment, setDownPayment] = useState<number>(90000);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [monthlyRent, setMonthlyRent] = useState<number>(2200);
  const [vacancyRate, setVacancyRate] = useState<number>(5);
  const [propertyTax, setPropertyTax] = useState<number>(3600);
  const [insurance, setInsurance] = useState<number>(1200);
  const [maintenance, setMaintenance] = useState<number>(200);
  const [otherExpenses, setOtherExpenses] = useState<number>(100);

  const results = useMemo(() => {
    const loanAmount = Math.max(0, purchasePrice - downPayment);
    const monthlyPmt = pmt(loanAmount, interestRate, loanTerm);
    const grossIncome = monthlyRent * 12;
    const vacancyLoss = (vacancyRate / 100) * grossIncome;
    const effectiveIncome = grossIncome - vacancyLoss;
    const annualExpenses =
      propertyTax + insurance + maintenance * 12 + otherExpenses * 12;
    const noi = effectiveIncome - annualExpenses;
    const annualDebt = monthlyPmt * 12;
    const cashFlow = noi - annualDebt;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    const roi = downPayment > 0 ? (cashFlow / downPayment) * 100 : 0;
    return {
      noi,
      cashFlow,
      capRate,
      roi,
      monthlyCashFlow: cashFlow / 12,
    };
  }, [
    purchasePrice,
    downPayment,
    interestRate,
    loanTerm,
    monthlyRent,
    vacancyRate,
    propertyTax,
    insurance,
    maintenance,
    otherExpenses,
  ]);

  return (
    <div className="container mx-auto px-4 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium mb-6"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Property Investment Analyzer</h1>
      <p className="text-gray-600 mb-8">
        Analyze NOI, cash flow, cap rate, and ROI for rental property.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Property & financing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Purchase price ($)" value={purchasePrice} onChange={setPurchasePrice} min={1000} />
              <InputField label="Down payment ($)" value={downPayment} onChange={setDownPayment} min={0} />
              <InputField label="Interest rate (%)" value={interestRate} onChange={setInterestRate} min={0.1} max={30} step={0.125} />
              <InputField label="Loan term (years)" value={loanTerm} onChange={setLoanTerm} min={1} max={30} />
              <InputField label="Monthly rent ($)" value={monthlyRent} onChange={setMonthlyRent} min={0} />
              <InputField label="Vacancy rate (%)" value={vacancyRate} onChange={setVacancyRate} min={0} max={50} step={1} />
              <InputField label="Property tax ($/yr)" value={propertyTax} onChange={setPropertyTax} min={0} />
              <InputField label="Insurance ($/yr)" value={insurance} onChange={setInsurance} min={0} />
              <InputField label="Maintenance ($/mo)" value={maintenance} onChange={setMaintenance} min={0} />
              <InputField label="Other expenses ($/mo)" value={otherExpenses} onChange={setOtherExpenses} min={0} />
            </div>
            <button
              type="button"
              className="mt-6 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Calculate
            </button>
          </div>
          <ToolLinks excludeHref="/property-investment-analyzer" />
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Investment metrics"
              value={`${results.capRate.toFixed(2)}% cap rate`}
              details={`NOI (annual): $${results.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nCash flow (annual): $${results.cashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nCash flow (monthly): $${results.monthlyCashFlow.toFixed(2)}\nCap rate: ${results.capRate.toFixed(2)}%\nROI: ${results.roi.toFixed(2)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
