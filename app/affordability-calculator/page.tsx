"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import ToolLinks from "../../components/ToolLinks";

function principalFromPmt(monthlyPmt: number, annualRate: number, years: number): number {
  if (monthlyPmt <= 0 || years <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return (monthlyPmt * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
}

export default function AffordabilityCalculator() {
  const [annualIncome, setAnnualIncome] = useState<number>(120000);
  const [monthlyDebts, setMonthlyDebts] = useState<number>(500);
  const [downPayment, setDownPayment] = useState<number>(60000);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [propertyTax, setPropertyTax] = useState<number>(4000);
  const [homeInsurance, setHomeInsurance] = useState<number>(1200);
  const [hoaFees, setHoaFees] = useState<number>(0);

  const { maxHomePrice, estimatedMonthlyPayment } = useMemo(() => {
    const monthlyIncome = annualIncome / 12;
    const maxHousingPayment = Math.max(0, 0.28 * monthlyIncome);

    const taxInsHoa = propertyTax / 12 + homeInsurance / 12 + hoaFees;
    const maxPi = Math.max(0, maxHousingPayment - taxInsHoa);
    const maxPrincipal = principalFromPmt(maxPi, interestRate, loanTerm);
    const maxPrice = maxPrincipal + downPayment;

    const principal = Math.max(0, maxPrice - downPayment);
    const r = interestRate / 100 / 12;
    const n = loanTerm * 12;
    const pi =
      principal > 0 && n > 0
        ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : 0;
    const monthlyPayment = pi + taxInsHoa;

    return {
      maxHomePrice: Math.max(0, maxPrice),
      estimatedMonthlyPayment: monthlyPayment,
    };
  }, [
    annualIncome,
    monthlyDebts,
    downPayment,
    interestRate,
    loanTerm,
    propertyTax,
    homeInsurance,
    hoaFees,
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Home Affordability Calculator</h1>
      <p className="text-gray-600 mb-8">
        See how much home you can afford. Housing cost does not exceed 28% of gross monthly income.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your finances</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Annual income ($)"
                value={annualIncome}
                onChange={setAnnualIncome}
                min={0}
              />
              <InputField
                label="Monthly debts ($)"
                value={monthlyDebts}
                onChange={setMonthlyDebts}
                min={0}
              />
              <InputField
                label="Down payment ($)"
                value={downPayment}
                onChange={setDownPayment}
                min={0}
              />
              <InputField
                label="Interest rate (%)"
                value={interestRate}
                onChange={setInterestRate}
                min={0.1}
                max={30}
                step={0.125}
              />
              <InputField
                label="Loan term (years)"
                value={loanTerm}
                onChange={setLoanTerm}
                min={1}
                max={30}
              />
              <InputField
                label="Property tax (yearly $)"
                value={propertyTax}
                onChange={setPropertyTax}
                min={0}
              />
              <InputField
                label="Home insurance (yearly $)"
                value={homeInsurance}
                onChange={setHomeInsurance}
                min={0}
              />
              <InputField label="HOA fees (monthly $)" value={hoaFees} onChange={setHoaFees} min={0} />
            </div>
          </div>

          <ToolLinks excludeHref="/affordability-calculator" />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="What you can afford"
              value={`$${Math.round(maxHomePrice).toLocaleString()}`}
              details={`Maximum home price: $${Math.round(maxHomePrice).toLocaleString()}\nEstimated monthly payment: $${estimatedMonthlyPayment.toFixed(2)}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
