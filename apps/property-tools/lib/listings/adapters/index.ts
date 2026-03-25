import { rentcastListingsAdapter } from "./rentcast";

export function getListingsAdapter() {
  return rentcastListingsAdapter;
}

export type { ListingResult, ListingSearchInput, ListingsAdapter } from "./types";
