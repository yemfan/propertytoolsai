import Link from "next/link";
import type { Metadata } from "next";
import SavedResultsClient from "./SavedResultsClient";

export const metadata: Metadata = {
  title: "My saved calculator results | PropertyTools AI",
  description:
    "View and manage the calculator scenarios you've saved across mortgage, cap-rate, CMA, and other tools.",
};

export default function AccountSavedResultsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm font-medium text-[#0066b3] hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          My saved calculator results
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Every scenario you&apos;ve saved, newest first. Click one to see the
          inputs and the numbers you calculated.
        </p>
      </div>
      <SavedResultsClient />
    </div>
  );
}
