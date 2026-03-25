import type { PropertySeoRecord } from "./types";
import { buildPropertyFaq, buildPropertySeoDescription } from "./content";
import { slugifyPropertyAddress } from "./slug";

function estimateMonthlyPayment(price: number) {
  return Math.round(price * 0.0065);
}

function estimateIncomeNeeded(monthlyPayment: number) {
  return Math.round((monthlyPayment * 12) / 0.3);
}

export async function getPropertySeoRecordBySlug(slug: string): Promise<PropertySeoRecord | null> {
  const mockAddress = "123 Maple Ave, Pasadena, CA 91101";
  const canonicalSlug = slugifyPropertyAddress(mockAddress);
  if (slug !== canonicalSlug) {
    return null;
  }

  const estimateValue = 845000;
  const monthlyPayment = estimateMonthlyPayment(estimateValue);

  const record: PropertySeoRecord = {
    slug,
    fullAddress: mockAddress,
    streetAddress: "123 Maple Ave",
    city: "Pasadena",
    state: "CA",
    zip: "91101",
    lat: 34.1478,
    lng: -118.1445,
    propertyType: "single_family",
    beds: 3,
    baths: 2,
    sqft: 1580,
    lotSize: 6400,
    yearBuilt: 1958,
    estimateValue,
    estimateRangeLow: 812000,
    estimateRangeHigh: 878000,
    rentEstimate: 4200,
    medianPpsf: 535,
    description: "",
    photos: [
      {
        id: "1",
        url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1200&auto=format&fit=crop",
        alt: mockAddress,
      },
      {
        id: "2",
        url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80&w=1200&auto=format&fit=crop",
        alt: `${mockAddress} exterior`,
      },
    ],
    comps: [
      {
        id: "comp_1",
        address: "120 Nearby Ave, Pasadena, CA 91101",
        soldPrice: 832000,
        soldDate: "2026-01-11",
        beds: 3,
        baths: 2,
        sqft: 1510,
        distanceMiles: 0.3,
      },
      {
        id: "comp_2",
        address: "87 Oak St, Pasadena, CA 91101",
        soldPrice: 869000,
        soldDate: "2025-12-20",
        beds: 3,
        baths: 2,
        sqft: 1625,
        distanceMiles: 0.5,
      },
    ],
    nearbyListings: [
      {
        id: "listing_1",
        address: "88 Fairview Dr, Pasadena, CA 91101",
        city: "Pasadena",
        state: "CA",
        zip: "91101",
        price: 879000,
        beds: 3,
        baths: 2,
        sqft: 1600,
        photoUrl:
          "https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=1200&auto=format&fit=crop",
      },
      {
        id: "listing_2",
        address: "55 Pine Ave, Pasadena, CA 91101",
        city: "Pasadena",
        state: "CA",
        zip: "91101",
        price: 815000,
        beds: 2,
        baths: 2,
        sqft: 1430,
        photoUrl:
          "https://images.unsplash.com/photo-1576941089067-2de3c901e126?q=80&w=1200&auto=format&fit=crop",
      },
    ],
    affordabilityExample: {
      purchasePrice: estimateValue,
      estimatedMonthlyPayment: monthlyPayment,
      requiredIncome: estimateIncomeNeeded(monthlyPayment),
    },
    faq: [],
    neighborhoodLinks: [
      { label: "Pasadena home values", href: "/home-value" },
      { label: "Can I afford Pasadena?", href: "/affordability" },
      { label: "Homes for sale in Pasadena", href: "/search?city=Pasadena&state=CA" },
    ],
  };

  record.description = buildPropertySeoDescription(record);
  record.faq = buildPropertyFaq(record);

  return record;
}
