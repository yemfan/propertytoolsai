"use client";

import { AddressMinimap } from "@mapbox/search-js-react";
import type { AddressSelection } from "@/lib/home-value/types";

export function AddressConfirmMinimap({ address }: { address: AddressSelection }) {
  return (
    <AddressMinimap
      accessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!}
      feature={{
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [address.lng!, address.lat!],
        },
        properties: {
          full_address: address.fullAddress,
        },
      }}
      show={true}
      canAdjustMarker={false}
    />
  );
}
