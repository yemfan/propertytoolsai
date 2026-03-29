/**
 * URL pattern: /guides/{topicSlug}/{locationSlug}
 * Both segments stay kebab-case; uniqueness is (topic_slug, location_slug).
 */

export function buildGuidePath(topicSlug: string, locationSlug: string): string {
  return `/guides/${topicSlug}/${locationSlug}`;
}

export function isValidSlugSegment(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}
