import Link from "next/link";
import type { Metadata } from "next";
import SavedSearchesClient from "./SavedSearchesClient";

export const metadata: Metadata = {
  title: "My saved searches | PropertyTools AI",
  description:
    "View, edit, and manage the property searches you've saved for alerts.",
};

export default function AccountSavedSearchesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm font-medium text-[#0066b3] hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">My saved searches</h1>
        <p className="mt-2 text-sm text-slate-600">
          Get an email as soon as a new listing matches one of your searches.
          Pause or delete anytime.
        </p>
      </div>
      <SavedSearchesClient />
    </div>
  );
}
