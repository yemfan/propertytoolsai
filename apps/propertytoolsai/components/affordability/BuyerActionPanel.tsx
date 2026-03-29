"use client";

import React from "react";

export function BuyerActionPanel() {
  const actions = [
    "Compare lender scenarios",
    "Get matched with homes in your price range",
    "Review down payment strategies",
  ];

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Next Steps</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <div key={action} className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
            {action}
          </div>
        ))}
      </div>
    </section>
  );
}
