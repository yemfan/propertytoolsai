"use client";

import React from "react";

export function AffordabilityHero() {
  return (
    <section className="rounded-3xl border bg-white p-8 shadow-sm md:p-10">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
          PropertyToolsAI
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
          Buyer Affordability Report
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
          See how much home you may be able to afford, compare rate scenarios, and unlock a
          personalized buying plan.
        </p>
      </div>
    </section>
  );
}
