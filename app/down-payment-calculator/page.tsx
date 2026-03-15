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

export default function DownPaymentCalculator() {
  const [homePrice, setHomePrice] = useState<number>(400000);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [savingsAvailable, setSavingsAvailable] = useState<number>(90000);
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [propertyTax, setPropertyTax] = useState<number>(4000);
  const [homeInsurance, setHomeInsurance] = useState<number>(1200);
  const [hoaFees, setHoaFees] = useState<number>(0);

  const { downPaymentAmount, remainingLoanAmount, monthlyPayment } = useMemo(() => {
    const desiredDown = (homePrice * downPaymentPercent) / 100;
    const downPaymentAmount = Math.min(desiredDown, Math.max(0, savingsAvailable));
    const remainingLoanAmount = Math.max(0, homePrice - downPaymentAmount);
    const taxInsHoa = propertyTax / 12 + homeInsurance / 12 + hoaFees;
    const pi = pmt(remainingLoanAmount, interestRate, loanTerm);
    const monthlyPayment = pi + taxInsHoa;

    return {
      downPaymentAmount,
      remainingLoanAmount,
      monthlyPayment,
    };
  }, [
    homePrice,
    downPaymentPercent,
    savingsAvailable,
    loanTerm,
    interestRate,
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Down Payment Calculator</h1>
      <p className="text-gray-600 mb-8">
        See your down payment, loan amount, and monthly payment. Down payment is capped by savings.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Home price ($)" value={homePrice} onChange={setHomePrice} min={1000} />
              <InputField
                label="Down payment (%)"
                value={downPaymentPercent}
                onChange={setDownPaymentPercent}
                min={0}
                max={100}
                step={0.5}
              />
              <InputField
                label="Savings available ($)"
                value={savingsAvailable}
                onChange={setSavingsAvailable}
                min={0}
              />
              <InputField label="Loan term (years)" value={loanTerm} onChange={setLoanTerm} min={1} max={30} />
              <InputField
                label="Interest rate (%)"
                value={interestRate}
                onChange={setInterestRate}
                min={0.1}
                max={30}
                step={0.125}
              />
              <InputField label="Property tax (yearly $)" value={propertyTax} onChange={setPropertyTax} min={0} />
              <InputField label="Home insurance (yearly $)" value={homeInsurance} onChange={setHomeInsurance} min={0} />
              <InputField label="HOA fees (monthly $)" value={hoaFees} onChange={setHoaFees} min={0} />
            </div>
          </div>

          <ToolLinks excludeHref="/down-payment-calculator" />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Down payment results"
              value={`$${downPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              details={`Down payment amount: $${downPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nRemaining loan amount: $${remainingLoanAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nMonthly payment (incl. tax, insurance, HOA): $${monthlyPayment.toFixed(2)}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
