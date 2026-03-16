"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import ToolLinks from "../../components/ToolLinks";

export default function CapRateCalculator() {
  const [purchasePrice, setPurchasePrice] = useState<number>(400000);
  const [annualRent, setAnnualRent] = useState<number>(28800);
  const [vacancyRate, setVacancyRate] = useState<number>(5);
  const [propertyTax, setPropertyTax] = useState<number>(4800);
  const [insurance, setInsurance] = useState<number>(1200);
  const [maintenance, setMaintenance] = useState<number>(2400);
  const [otherExpenses, setOtherExpenses] = useState<number>(1200);

  const results = useMemo(() => {
    const effectiveIncome = annualRent * (1 - vacancyRate / 100);
    const totalExpenses =
      propertyTax + insurance + maintenance + otherExpenses;
    const noi = effectiveIncome - totalExpenses;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    return {
      noi,
      capRate,
      effectiveIncome,
      totalExpenses,
    };
  }, [
    purchasePrice,
    annualRent,
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Cap Rate Calculator</h1>
      <p className="text-gray-600 mb-8">
        Calculate capitalization rate from NOI and purchase price.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
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
            <button
              type="button"
              className="mt-6 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Calculate
            </button>
          </div>
          <ToolLinks excludeHref="/cap-rate-calculator" />
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Cap rate"
              value={`${results.capRate.toFixed(2)}%`}
              details={`NOI: $${results.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nEffective income: $${results.effectiveIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nTotal expenses: $${results.totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nCap rate: ${results.capRate.toFixed(2)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
