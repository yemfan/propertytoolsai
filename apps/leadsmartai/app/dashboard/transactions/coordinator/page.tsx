import type { Metadata } from "next";

import CoordinatorClient from "./CoordinatorClient";

export const metadata: Metadata = {
  title: "Transaction coordinator | LeadSmart AI",
  robots: { index: false },
};

export default function CoordinatorPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Transaction coordinator
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          One column per stage of the deal. Cards show transactions with
          open work at that stage, sorted overdue-first. Click a card to
          jump to the deal.
        </p>
      </header>

      <CoordinatorClient />
    </main>
  );
}
