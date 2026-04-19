import Link from "next/link";
import type { Metadata } from "next";
import FavoritesClient from "./FavoritesClient";

export const metadata: Metadata = {
  title: "My favorites | PropertyTools AI",
  description: "The listings you've saved.",
};

export default function AccountFavoritesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm font-medium text-[#0066b3] hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">My favorites</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your agent can see this list and suggest similar listings when
          they come on market.
        </p>
      </div>
      <FavoritesClient />
    </div>
  );
}
