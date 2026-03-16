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

export default function RentVsBuyCalculator() {
  const [monthlyRent, setMonthlyRent] = useState<number>(2000);
  const [homePrice, setHomePrice] = useState<number>(400000);
  const [downPayment, setDownPayment] = useState<number>(80000);
  const [mortgageRate, setMortgageRate] = useState<number>(6.5);
  const [propertyTaxRate, setPropertyTaxRate] = useState<number>(1.2);
  const [expectedAppreciation, setExpectedAppreciation] = useState<number>(3);
  const [yearsToStay, setYearsToStay] = useState<number>(5);

  const { totalCostRenting, totalCostBuying, recommendation } = useMemo(() => {
    const totalCostRenting = monthlyRent * 12 * yearsToStay;
    const loanAmount = Math.max(0, homePrice - downPayment);
    const monthlyPmt = pmt(loanAmount, mortgageRate, 30);
    const annualPropertyTax = (homePrice * propertyTaxRate) / 100;
    const totalCostBuying =
      downPayment + monthlyPmt * 12 * yearsToStay + annualPropertyTax * yearsToStay;
    const recommendation = totalCostRenting < totalCostBuying ? "Rent" : "Buy";
    return {
      totalCostRenting,
      totalCostBuying,
      recommendation,
    };
  }, [
    monthlyRent,
    homePrice,
    downPayment,
    mortgageRate,
    propertyTaxRate,
    yearsToStay,
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Rent vs Buy Calculator</h1>
      <p className="text-gray-600 mb-8">
        Compare total costs over your planned stay. Buying builds equity; this compares out-of-pocket costs.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assumptions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Monthly rent ($)"
                value={monthlyRent}
                onChange={setMonthlyRent}
                min={0}
              />
              <InputField
                label="Home price ($)"
                value={homePrice}
                onChange={setHomePrice}
                min={1000}
              />
              <InputField
                label="Down payment ($)"
                value={downPayment}
                onChange={setDownPayment}
                min={0}
              />
              <InputField
                label="Mortgage rate (%)"
                value={mortgageRate}
                onChange={setMortgageRate}
                min={0.1}
                max={30}
                step={0.125}
              />
              <InputField
                label="Property tax rate (% per year)"
                value={propertyTaxRate}
                onChange={setPropertyTaxRate}
                min={0}
                max={10}
                step={0.1}
              />
              <InputField
                label="Expected appreciation (% per year)"
                value={expectedAppreciation}
                onChange={setExpectedAppreciation}
                min={-5}
                max={20}
                step={0.5}
              />
              <InputField
                label="Years planning to stay"
                value={yearsToStay}
                onChange={setYearsToStay}
                min={1}
                max={30}
              />
            </div>
          </div>

          <ToolLinks excludeHref="/rent-vs-buy-calculator" />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Comparison"
              value={recommendation}
              details={`Total cost renting (${yearsToStay} yrs): $${totalCostRenting.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nTotal cost buying (${yearsToStay} yrs): $${totalCostBuying.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nRecommendation: ${recommendation}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
