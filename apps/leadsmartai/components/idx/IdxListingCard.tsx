import Link from "next/link";

import type { IdxListingSummary } from "@/lib/idx/types";

function formatPrice(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "Price on request";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatBedsBaths(beds: number | null, baths: number | null, sqft: number | null): string {
  const parts: string[] = [];
  if (beds !== null) parts.push(`${beds} bd`);
  if (baths !== null) parts.push(`${baths} ba`);
  if (sqft !== null) parts.push(`${sqft.toLocaleString()} sqft`);
  return parts.join(" · ");
}

export default function IdxListingCard({ listing }: { listing: IdxListingSummary }) {
  const href = `/homes/${encodeURIComponent(listing.id)}`;
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {listing.heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.heroPhoto}
            alt={`${listing.formattedAddress} hero photo`}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Photo unavailable
          </div>
        )}
        {listing.status !== "active" ? (
          <span className="absolute left-3 top-3 rounded-full bg-slate-900/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {listing.status.replace("_", " ")}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="text-lg font-bold text-slate-900">
          {formatPrice(listing.price)}
        </div>
        <div className="mt-1 text-sm text-slate-700">
          {formatBedsBaths(listing.beds, listing.baths, listing.sqft) || "Details on request"}
        </div>
        <div className="mt-1 truncate text-sm text-slate-600">
          {listing.formattedAddress}
        </div>
        {listing.city || listing.state ? (
          <div className="mt-0.5 text-xs text-slate-500">
            {[listing.city, listing.state, listing.zip].filter(Boolean).join(", ")}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
