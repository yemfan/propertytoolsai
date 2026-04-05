/**
 * Renders a BreadcrumbList + WebPage JSON-LD block for SEO city pages.
 * Drop this inside the page's <main> or <div> wrapper — it outputs a
 * <script type="application/ld+json"> tag which Google reads for rich snippets.
 */

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface Props {
  /** Page title (used in WebPage schema) */
  title: string;
  /** Page description */
  description: string;
  /** Canonical URL of this page */
  url: string;
  /** Ordered breadcrumb trail, e.g. [Home, Home Value, Austin TX] */
  breadcrumbs: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ title, description, url, breadcrumbs }: Props) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.propertytoolsai.com";

  const listItems = breadcrumbs.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.label,
    item: item.href.startsWith("http")
      ? item.href
      : `${siteUrl}${item.href}`,
  }));

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: listItems,
      },
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: title,
        description,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: siteUrl,
          name: "PropertyTools AI",
        },
        breadcrumb: { "@type": "BreadcrumbList", itemListElement: listItems },
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
