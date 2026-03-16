"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import ToolLinks from "../../components/ToolLinks";

export default function CashFlowCalculator() {
  const [monthlyRent, setMonthlyRent] = useState<number>(2500);
  const [monthlyMortgage, setMonthlyMortgage] = useState<number>(1800);
  const [propertyTax, setPropertyTax] = useState<number>(400);
  const [insurance, setInsurance] = useState<number>(150);
  const [hoa, setHoa] = useState<number>(0);
  const [maintenance, setMaintenance] = useState<number>(200);
  const [otherExpenses, setOtherExpenses] = useState<number>(100);
  const [vacancyMonths, setVacancyMonths] = useState<number>(0);

  const results = useMemo(() => {
    const income = monthlyRent * (12 - vacancyMonths);
    const expenses =
      monthlyMortgage * 12 +
      propertyTax * 12 +
      insurance * 12 +
      hoa * 12 +
      maintenance * 12 +
      otherExpenses * 12;
    const annualCashFlow = income - expenses;
    const monthlyCashFlow = annualCashFlow / 12;
    return {
      annualIncome: income,
      annualExpenses: expenses,
      annualCashFlow,
      monthlyCashFlow,
    };
  }, [
    monthlyRent,
    monthlyMortgage,
    propertyTax,
    insurance,
    hoa,
    maintenance,
    otherExpenses,
    vacancyMonths,
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Cash Flow Calculator</h1>
      <p className="text-gray-600 mb-8">
        Estimate monthly and annual cash flow from rental property.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Income & expenses</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Monthly rent ($)" value={monthlyRent} onChange={setMonthlyRent} min={0} />
              <InputField label="Monthly mortgage ($)" value={monthlyMortgage} onChange={setMonthlyMortgage} min={0} />
              <InputField label="Property tax ($/mo)" value={propertyTax} onChange={setPropertyTax} min={0} />
              <InputField label="Insurance ($/mo)" value={insurance} onChange={setInsurance} min={0} />
              <InputField label="HOA ($/mo)" value={hoa} onChange={setHoa} min={0} />
              <InputField label="Maintenance ($/mo)" value={maintenance} onChange={setMaintenance} min={0} />
              <InputField label="Other ($/mo)" value={otherExpenses} onChange={setOtherExpenses} min={0} />
              <InputField label="Vacancy (months/yr)" value={vacancyMonths} onChange={setVacancyMonths} min={0} max={12} />
            </div>
            <button
              type="button"
              className="mt-6 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Calculate
            </button>
          </div>
          <ToolLinks excludeHref="/cash-flow-calculator" />
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Cash flow"
              value={`$${results.monthlyCashFlow.toFixed(2)}/mo`}
              details={`Annual income: $${results.annualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nAnnual expenses: $${results.annualExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nAnnual cash flow: $${results.annualCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nMonthly cash flow: $${results.monthlyCashFlow.toFixed(2)}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
