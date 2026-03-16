"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r shadow-sm min-h-screen p-6">

      {/* Logo */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          PropertyToolsAI
        </h1>
        <p className="text-sm text-gray-500">
          Real Estate Calculators
        </p>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">

        <Link
          href="/"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Home
        </Link>

        <Link
          href="/mortgage-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Mortgage Calculator
        </Link>

        <Link
          href="/refinance-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Refinance Calculator
        </Link>

        <Link
          href="/affordability-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Affordability Calculator
        </Link>

        <Link
          href="/rent-vs-buy-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Rent vs Buy Calculator
        </Link>

        <Link
          href="/closing-cost-estimator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Closing Cost Estimator
        </Link>

        <Link
          href="/property-investment-analyzer"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Property Investment Analyzer
        </Link>

        <Link
          href="/down-payment-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Down Payment Calculator
        </Link>

        <Link
          href="/cash-flow-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Cash Flow Calculator
        </Link>

        <Link
          href="/cap-rate-calculator"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Cap Rate & ROI Calculator
        </Link>

      </nav>

      {/* Footer */}
      <div className="absolute bottom-6 text-xs text-gray-400">
        © 2026 PropertyToolsAI
      </div>

    </aside>
  );
}
