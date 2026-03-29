"use client";

import dynamic from "next/dynamic";
import type { AddressSelection } from "@/lib/home-value/types";

/** Set to `true` to restore the minimap / static Mapbox image on the confirm-address step. */
const SHOW_MAP_PREVIEW = false;

const AddressConfirmMinimap = dynamic(
  () =>
    import("./AddressConfirmMinimap").then((m) => ({
      default: m.AddressConfirmMinimap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading map…</div>
    ),
  }
);

type Props = {
  address: AddressSelection | null;
  onConfirm: () => void;
  onEdit: () => void;
  isBusy: boolean;
};

function StaticMapFallback({ address }: { address: AddressSelection }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;
  if (typeof address.lat !== "number" || typeof address.lng !== "number") {
    return (
      <div className="flex h-[320px] items-center justify-center p-6 text-sm text-gray-500">
        Map preview unavailable for this address.
      </div>
    );
  }

  const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+111827(${address.lng},${address.lat})/${address.lng},${address.lat},15,0/800x500?access_token=${token}`;

  return (
    <img
      src={src}
      alt={`Map preview for ${address.fullAddress}`}
      className="h-[320px] w-full object-cover"
    />
  );
}

export function AddressConfirmCard({ address, onConfirm, onEdit, isBusy }: Props) {
  if (!address) return null;

  const canShowMap =
    SHOW_MAP_PREVIEW && typeof address.lat === "number" && typeof address.lng === "number";

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className={SHOW_MAP_PREVIEW ? "grid gap-6 lg:grid-cols-[1fr_420px]" : "grid gap-6"}>
        <div>
          <div className="inline-flex rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Confirm Address
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">Is this the right property?</h2>

          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            {SHOW_MAP_PREVIEW
              ? "Review the address and map location before generating the estimate."
              : "Review the address before generating the estimate."}
          </p>

          <div className="mt-6 rounded-2xl border bg-gray-50 p-5">
            <div className="text-sm font-medium text-gray-500">Selected Address</div>
            <div className="mt-2 text-lg font-semibold text-gray-900">{address.fullAddress}</div>

            <div className="mt-3 text-sm text-gray-600">
              {address.city}, {address.state} {address.zip}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isBusy}
              className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isBusy ? "Generating..." : "Confirm & Continue"}
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            >
              Edit Address
            </button>
          </div>
        </div>

        {SHOW_MAP_PREVIEW ? (
          <div className="overflow-hidden rounded-3xl border bg-gray-50">
            {canShowMap ? (
              <div className="relative h-[320px]">
                <AddressConfirmMinimap address={address} />
              </div>
            ) : (
              <StaticMapFallback address={address} />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
