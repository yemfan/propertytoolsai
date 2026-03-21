import type { PropertyCore } from "./propertyService";

export async function fetchPropertyData(
  address: string
): Promise<PropertyCore> {
  return {
    address,
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    beds: 3,
    baths: 2,
    sqft: 1500,
    price: 800000,
    rent: 3200,
  };
}

