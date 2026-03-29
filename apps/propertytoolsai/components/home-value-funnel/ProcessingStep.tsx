"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Matching your address to local market data…",
  "Checking recent comparable sales in your area…",
  "Applying home size, condition, and lot signals…",
  "Building your estimated range and confidence score…",
];

export default function ProcessingStep() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setI((x) => (x + 1) % MESSAGES.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center">
      <div
        className="h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-[#0072ce]"
        role="status"
        aria-label="Loading"
      />
      <div>
        <p className="text-lg font-semibold text-gray-900">Analyzing your home value</p>
        <p className="mt-2 text-sm text-gray-600 transition-opacity duration-300">{MESSAGES[i]}</p>
        <p className="mt-4 text-xs text-gray-500">Usually takes just a few seconds.</p>
      </div>
    </div>
  );
}
