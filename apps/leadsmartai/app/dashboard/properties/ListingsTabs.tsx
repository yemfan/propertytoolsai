"use client";

import { useState } from "react";
import ListingsClient from "./ListingsClient";
import SellerPresentationClient from "../seller-presentation/SellerPresentationClient";
import type { ComponentProps } from "react";

/**
 * Listings page tabs — Listings (the agent's inventory: status,
 * showings, offers) and Presentations (AI seller presentations).
 * Presentations live here because a listing presentation is how a
 * listing gets won; the old /dashboard/seller-presentation page
 * redirects to this tab.
 */
export default function ListingsTabs({
  initialTab,
  listings,
  presentationProperties,
}: {
  initialTab: "listings" | "presentations";
  listings: ComponentProps<typeof ListingsClient>["listings"];
  presentationProperties: Array<Record<string, unknown>>;
}) {
  const [tab, setTab] = useState<"listings" | "presentations">(initialTab);

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b border-slate-200 px-4 pt-4 sm:px-6">
        {(
          [
            { id: "listings", label: "Listings" },
            { id: "presentations", label: "Presentations" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-[#0B1F44] text-[#0B1F44]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "listings" ? (
        <ListingsClient listings={listings} />
      ) : (
        <SellerPresentationClient properties={presentationProperties} />
      )}
    </div>
  );
}
