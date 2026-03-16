"use client";

import { useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import ToolLinks from "../../components/ToolLinks";

export default function MortgageCalculator() {
  const [homePrice, setHomePrice] = useState<number>(300000);
  const [downPayment, setDownPayment] = useState<number>(60000);
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [interestRate, setInterestRate] = useState<number>(5);
  const [propertyTax, setPropertyTax] = useState<number>(3000);
  const [homeInsurance, setHomeInsurance] = useState<number>(1000);
  const [hoaFees, setHoaFees] = useState<number>(0);

  const principal = Math.max(0, homePrice - downPayment);
  const monthlyInterest = interestRate / 100 / 12;
  const numberOfPayments = loanTerm * 12;
  const monthlyPayment =
    principal > 0 && numberOfPayments > 0
      ? (principal * (monthlyInterest * Math.pow(1 + monthlyInterest, numberOfPayments))) /
        (Math.pow(1 + monthlyInterest, numberOfPayments) - 1)
      : 0;
  const totalMonthly = monthlyPayment + propertyTax / 12 + homeInsurance / 12 + hoaFees;
  const totalInterest = monthlyPayment * numberOfPayments - principal;
  const totalPayment = monthlyPayment * numberOfPayments + propertyTax * loanTerm + homeInsurance * loanTerm + hoaFees * 12 * loanTerm;

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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Mortgage Calculator</h1>
      <p className="text-gray-600 mb-8">Estimate your monthly payment, total interest, and total cost.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Home price ($)" value={homePrice} onChange={setHomePrice} min={1000} />
              <InputField label="Down payment ($)" value={downPayment} onChange={setDownPayment} min={0} />
              <InputField label="Loan term (years)" value={loanTerm} onChange={setLoanTerm} min={1} max={30} />
              <InputField label="Interest rate (%)" value={interestRate} onChange={setInterestRate} min={0.1} max={30} step={0.125} />
              <InputField label="Property tax (yearly $)" value={propertyTax} onChange={setPropertyTax} min={0} />
              <InputField label="Home insurance (yearly $)" value={homeInsurance} onChange={setHomeInsurance} min={0} />
              <InputField label="HOA fees (monthly $)" value={hoaFees} onChange={setHoaFees} min={0} />
            </div>
            <button
              type="button"
              className="mt-6 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Calculate
            </button>
          </div>

          <ToolLinks excludeHref="/mortgage-calculator" />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Estimated monthly payment"
              value={`$${totalMonthly.toFixed(2)}`}
              details={`Principal & interest: $${monthlyPayment.toFixed(2)}\nTotal interest over ${loanTerm} years: $${totalInterest.toFixed(2)}\nTotal payment: $${totalPayment.toFixed(2)}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
