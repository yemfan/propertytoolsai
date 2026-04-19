/**
 * Consumer-facing subset of the contacts types. Mirrors what
 * apps/leadsmartai/lib/contacts/types.ts exports, scoped to the
 * saved-search + event-tracking shapes that propertytoolsai needs.
 *
 * Kept as a separate file (rather than importing from leadsmartai)
 * because the two apps are independently deployable and we don't want
 * a build-time dep. A future cleanup could promote these to
 * packages/shared, but low priority — the types are small and stable.
 */

export type AlertFrequency = "instant" | "daily" | "weekly" | "never";

export type PropertyTypeFilter =
  | "single_family"
  | "condo"
  | "townhouse"
  | "multi_family"
  | "any";

export type SavedSearchCriteria = {
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: PropertyTypeFilter;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  sqftMin?: number;
  anchorAddress?: string;
  radiusMiles?: number;
};

export type SavedSearch = {
  id: string;
  contactId: string;
  name: string;
  criteria: SavedSearchCriteria;
  alertFrequency: AlertFrequency;
  lastAlertedAt: string | null;
  lastMatchedListingIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// Kept in sync with BEHAVIOR_EVENT_TYPES in
// apps/leadsmartai/lib/contacts/behavior/scoring.ts. The scoring cron
// validates against its own list; this copy is used by the tracking
// endpoint on propertytoolsai to reject unknown types early.
export const BEHAVIOR_EVENT_TYPES = [
  "property_view",
  "property_favorite",
  "favorite_removed",
  "property_share",
  "search_performed",
  "saved_search_created",
  "saved_search_match",
  "listing_alert_opened",
  "listing_alert_clicked",
  "return_visit",
  "report_unlocked",
] as const;

export type BehaviorEventType = (typeof BEHAVIOR_EVENT_TYPES)[number];

export function isBehaviorEventType(v: string): v is BehaviorEventType {
  return (BEHAVIOR_EVENT_TYPES as readonly string[]).includes(v);
}
