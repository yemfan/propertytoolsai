/**
 * Structured data generation for SEO
 * Generates schema.org JSON-LD for Google rich snippets
 */

interface ReviewData {
  rating: number;
  count: number;
  averageRating: number;
}

interface LocalBusinessData {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  reviews?: ReviewData;
}

/**
 * Generate schema.org/Organization structured data
 * Used for company branding in search results
 */
export function generateOrganizationSchema(data: {
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  email?: string;
  phone?: string;
  sameAs?: string[]; // Social media URLs
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: data.name,
    description: data.description,
    url: data.website,
    logo: data.logo,
    email: data.email,
    telephone: data.phone,
    sameAs: data.sameAs || [],
  };
}

/**
 * Generate schema.org/LocalBusiness structured data with aggregated reviews
 * Used for local search visibility and rich snippets (stars, reviews count)
 */
export function generateLocalBusinessSchema(data: LocalBusinessData) {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: data.name,
    description: data.description,
    url: data.website,
    telephone: data.phone,
  };

  // Add address if available
  if (data.address) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: data.address.split(",")[0]?.trim(),
      addressLocality: data.address.split(",")[1]?.trim(),
    };
  }

  // Add aggregated rating from Google reviews
  if (data.reviews) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: data.reviews.averageRating.toFixed(1),
      reviewCount: data.reviews.count,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return schema;
}

/**
 * Generate schema.org/BreadcrumbList for navigation
 * Used to show breadcrumb navigation in search results
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate schema.org/WebPage structured data
 * Used for page-level metadata
 */
export function generateWebPageSchema(data: {
  name: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: data.name,
    description: data.description,
    url: data.url,
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified,
  };
}

/**
 * Convert schema objects to JSON-LD string for use in <script> tags
 */
export function toJsonLd(schemas: any[]) {
  if (schemas.length === 1) {
    return JSON.stringify(schemas[0]);
  }
  // Multiple schemas should be wrapped in an array
  return JSON.stringify(schemas);
}

/**
 * Generate Open Graph meta tags for social sharing
 */
export function generateOpenGraphTags(data: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
}) {
  return {
    "og:title": data.title,
    "og:description": data.description,
    "og:url": data.url,
    "og:image": data.image,
    "og:type": data.type || "website",
  };
}

/**
 * Generate Twitter Card meta tags for Twitter sharing
 */
export function generateTwitterCardTags(data: {
  title: string;
  description: string;
  image?: string;
  creator?: string;
}) {
  return {
    "twitter:card": "summary_large_image",
    "twitter:title": data.title,
    "twitter:description": data.description,
    "twitter:image": data.image,
    "twitter:creator": data.creator,
  };
}
