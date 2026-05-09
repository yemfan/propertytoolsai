"use client";

import Link from "next/link";
import {
  LISTING_STATUS_LABEL,
  type ListingDetail,
  type ListingStatus,
} from "@/lib/listings/types";

const STATUS_BADGE: Record<ListingStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  contracted: "bg-blue-100 text-blue-800",
  withdrawn: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-600",
};

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 0) return formatDate(iso);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Listing detail page. Intentionally focused — surfaces the listing-
 * side essentials (property, status, dates, showings) and links into
 * the back-linked transaction for the post-acceptance lifecycle (escrow,
 * contingencies, closing).
 *
 * Phase 2b of the listings/transactions split. Compared to the legacy
 * /dashboard/transactions/[id] view this page:
 *
 *   - Reads from listings, not transactions
 *   - Uses the 6-state ListingStatus enum directly (no mapping)
 *   - Doesn't render contingency/escrow timelines (those belong to the
 *     contracted-deal view, reachable via the "Open contracted deal"
 *     link below the status badge)
 *
 * Phase 2c will add edit affordances (status changes, list-price
 * updates, etc.). For now this is read-only.
 */
export function ListingDetailClient({ listing }: { listing: ListingDetail }) {
  const cityState = [listing.city, listing.state].filter(Boolean).join(", ");
  const fullLocation = [cityState, listing.zip].filter(Boolean).join(" ");

  return (
    <main id="main-content" className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard/properties" className="hover:underline">
            Listings
          </Link>
          {" / "}
          <span className="truncate">{listing.property_address}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {listing.property_address}
            </h1>
            {fullLocation ? (
              <p className="mt-0.5 text-sm text-slate-500">{fullLocation}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[listing.status]}`}
          >
            {LISTING_STATUS_LABEL[listing.status]}
          </span>
        </div>

        {/* Lifecycle bridge: when the listing has a back-linked
            transaction (offer accepted), surface a deep link so the
            agent can open the contracted-deal view (contingencies,
            escrow, closing) without leaving the listing page. */}
        {listing.transactionId ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <Link
              href={`/dashboard/transactions/${listing.transactionId}`}
              className="font-medium hover:underline"
            >
              Open contracted deal →
            </Link>
            <span className="ml-2 text-[11px] text-blue-700">
              Closing date, contingencies, and escrow tasks live on the deal page.
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Key facts ────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Property">
          <DetailRow label="Address" value={listing.property_address} />
          <DetailRow label="City / State" value={cityState || "—"} />
          <DetailRow label="ZIP" value={listing.zip ?? "—"} />
          <DetailRow label="MLS #" value={listing.mls_number ?? "—"} />
          {listing.mls_url ? (
            <DetailRow
              label="Listing URL"
              value={
                <a
                  href={listing.mls_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open ↗
                </a>
              }
            />
          ) : null}
        </Card>

        <Card title="Pricing">
          <DetailRow label="List price" value={formatMoney(listing.list_price)} />
          <DetailRow
            label="Commission"
            value={listing.commission_pct != null ? `${listing.commission_pct}%` : "—"}
          />
        </Card>

        <Card title="Dates">
          <DetailRow label="Listed" value={formatDate(listing.listing_start_date)} />
          <DetailRow label="Expires" value={formatDate(listing.listing_end_date)} />
          <DetailRow label="Created" value={formatRelative(listing.created_at)} />
        </Card>

        <Card title="Seller">
          <DetailRow label="Name" value={listing.contactName ?? "—"} />
        </Card>

        <Card title="Showings">
          <DetailRow label="Total" value={String(listing.showings_total)} />
          <DetailRow label="Upcoming" value={String(listing.showings_upcoming)} />
          <DetailRow label="Last" value={formatRelative(listing.last_showing_at)} />
          <div className="pt-1">
            <Link
              href={`/dashboard/showings?propertyAddress=${encodeURIComponent(listing.property_address)}`}
              className="text-xs text-blue-600 hover:underline"
            >
              View all showings →
            </Link>
          </div>
        </Card>

        {listing.notes ? (
          <Card title="Notes">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {listing.notes}
            </p>
          </Card>
        ) : null}
      </section>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-slate-900">{value}</dd>
    </div>
  );
}
