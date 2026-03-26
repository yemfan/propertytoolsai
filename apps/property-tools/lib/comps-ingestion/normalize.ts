/** Matches `normalizeAddress` in `lib/propertyService.ts` (warehouse row key). */
export function normalizeWarehouseAddress(address: string) {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

export function daysSince(dateStr?: string | null) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

export function milesBetween(
  aLat?: number | null,
  aLng?: number | null,
  bLat?: number | null,
  bLng?: number | null
) {
  if (
    typeof aLat !== "number" ||
    typeof aLng !== "number" ||
    typeof bLat !== "number" ||
    typeof bLng !== "number"
  ) {
    return null;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
