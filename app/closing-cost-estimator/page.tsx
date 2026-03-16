"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import InputField from "../../components/InputField";
import ResultCard from "../../components/ResultCard";
import ToolLinks from "../../components/ToolLinks";

export default function ClosingCostEstimator() {
  const [homePrice, setHomePrice] = useState<number>(400000);
  const [loanAmount, setLoanAmount] = useState<number>(320000);
  const [originationPercent, setOriginationPercent] = useState<number>(1);
  const [titleInsurance, setTitleInsurance] = useState<number>(1500);
  const [appraisalFee, setAppraisalFee] = useState<number>(500);
  const [inspectionFee, setInspectionFee] = useState<number>(400);
  const [otherFees, setOtherFees] = useState<number>(800);

  const results = useMemo(() => {
    const origination = (loanAmount * originationPercent) / 100;
    const total =
      origination + titleInsurance + appraisalFee + inspectionFee + otherFees;
    const asPercentOfPrice = homePrice > 0 ? (total / homePrice) * 100 : 0;
    return {
      origination,
      titleInsurance,
      appraisalFee,
      inspectionFee,
      otherFees,
      total,
      asPercentOfPrice,
    };
  }, [
    homePrice,
    loanAmount,
    originationPercent,
    titleInsurance,
    appraisalFee,
    inspectionFee,
    otherFees,
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

      <h1 className="text-3xl font-bold text-blue-600 mb-2">Closing Cost Estimator</h1>
      <p className="text-gray-600 mb-8">
        Estimate total closing costs based on loan and typical fees.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost inputs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Home price ($)" value={homePrice} onChange={setHomePrice} min={1000} />
              <InputField label="Loan amount ($)" value={loanAmount} onChange={setLoanAmount} min={0} />
              <InputField label="Origination (%)" value={originationPercent} onChange={setOriginationPercent} min={0} max={5} step={0.25} />
              <InputField label="Title insurance ($)" value={titleInsurance} onChange={setTitleInsurance} min={0} />
              <InputField label="Appraisal fee ($)" value={appraisalFee} onChange={setAppraisalFee} min={0} />
              <InputField label="Inspection fee ($)" value={inspectionFee} onChange={setInspectionFee} min={0} />
              <InputField label="Other fees ($)" value={otherFees} onChange={setOtherFees} min={0} />
            </div>
            <button
              type="button"
              className="mt-6 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Calculate
            </button>
          </div>
          <ToolLinks excludeHref="/closing-cost-estimator" />
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ResultCard
              title="Estimated closing costs"
              value={`$${results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              details={`Origination: $${results.origination.toFixed(0)}\nTitle insurance: $${results.titleInsurance.toFixed(0)}\nAppraisal: $${results.appraisalFee.toFixed(0)}\nInspection: $${results.inspectionFee.toFixed(0)}\nOther: $${results.otherFees.toFixed(0)}\nTotal: $${results.total.toFixed(0)}\n(% of price: ${results.asPercentOfPrice.toFixed(2)}%)`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
