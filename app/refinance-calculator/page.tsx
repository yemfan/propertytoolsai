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

export default function RefinanceCalculator() {
  const [currentBalance, setCurrentBalance] = useState<number>(250000);
  const [currentRate, setCurrentRate] = useState<number>(6.5);
  const [newRate, setNewRate] = useState<number>(5.25);
  const [remainingTermYears, setRemainingTermYears] = useState<number>(25);
  const [closingCosts, setClosingCosts] = useState<number>(4000);

  const { paymentBefore, paymentAfter, monthlySavings, breakEvenMonths } = useMemo(() => {
    const paymentBefore = pmt(currentBalance, currentRate, remainingTermYears);
    const paymentAfter = pmt(currentBalance, newRate, remainingTermYears);
    const monthlySavings = Math.max(0, paymentBefore - paymentAfter);
    const breakEvenMonths = monthlySavings > 0 ? Math.ceil(closingCosts / monthlySavings) : 0;
    return {
      paymentBefore,
      paymentAfter,
      monthlySavings,
      breakEvenMonths,
    };
  }, [currentBalance, currentRate, newRate, remainingTermYears, closingCosts]);

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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Refinance Calculator</h1>
      <p className="text-gray-600 mb-8">
        Compare your current loan to a new rate. See monthly savings and break-even.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Current loan balance ($)"
                value={currentBalance}
                onChange={setCurrentBalance}
                min={1000}
              />
              <InputField
                label="Current interest rate (%)"
                value={currentRate}
                onChange={setCurrentRate}
                min={0.1}
                max={30}
                step={0.125}
              />
              <InputField
                label="New interest rate (%)"
                value={newRate}
                onChange={setNewRate}
                min={0.1}
                max={30}
                step={0.125}
              />
              <InputField
                label="Remaining loan term (years)"
                value={remainingTermYears}
                onChange={setRemainingTermYears}
                min={1}
                max={30}
              />
              <InputField
                label="Closing costs ($)"
                value={closingCosts}
                onChange={setClosingCosts}
                min={0}
              />
            </div>
          </div>

          <ToolLinks excludeHref="/refinance-calculator" />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Refinance results"
              value={`$${paymentAfter.toFixed(2)}`}
              details={`Monthly payment before: $${paymentBefore.toFixed(2)}\nMonthly payment after: $${paymentAfter.toFixed(2)}\nMonthly savings: $${monthlySavings.toFixed(2)}\nBreak-even (months): ${breakEvenMonths}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
