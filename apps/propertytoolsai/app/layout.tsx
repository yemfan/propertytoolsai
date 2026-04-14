import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Montserrat, Roboto } from "next/font/google";
import AppShell from "@/components/AppShell";
import { getSiteUrl } from "@/lib/siteUrl";

const fontHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700", "800"],
});

const fontBody = Roboto({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

const SITE_URL = getSiteUrl().replace(/\/$/, "");
const SITE_NAME = "PropertyTools AI";
const SITE_DESCRIPTION =
  "Professional real estate calculators, AI-powered home valuations, and market reports for buyers, investors, and agents.";

/**
 * Favicon order matters for some browsers: `public/favicon.ico` first, then `app/icon.png` (served at `/icon.png`).
 * `app/apple-icon.png` is still picked up by Next automatically for apple-touch-icon.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "real estate calculators",
    "home value estimator",
    "property valuation",
    "mortgage calculator",
    "cap rate calculator",
    "real estate agent tools",
    "market report",
    "investment property analysis",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // `images` is intentionally omitted: Next.js App Router auto-detects
    // `app/opengraph-image.tsx` and wires it as the og:image for this
    // route. Previously this hardcoded `/images/og-default.png` which
    // never existed on disk, so every social share had a broken preview.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // Same as openGraph.images — Next auto-picks up opengraph-image.tsx
    // for twitter:image as well.
    creator: "@propertytoolsai",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  // NOTE: Do NOT set a root-level canonical here. Next.js merges root
  // layout metadata into every child page that doesn't override it,
  // which causes all subpages (e.g. /about, /blog, /contact) to emit
  // <link rel="canonical" href="https://www.propertytoolsai.com/"> —
  // telling Google every page is a duplicate of the homepage.
  // Individual pages should set their own canonical via generateMetadata.
  alternates: {},
};

/**
 * JSON-LD structured data for Google rich results. Two graphs:
 *
 *   1. Organization — brand identity, logo, name. Surfaces as the
 *      knowledge panel + logo in search results.
 *
 *   2. WebSite with SearchAction — enables the "Sitelinks search box"
 *      in Google SERPs pointing at /home-value. Users can type an
 *      address straight into Google and land on the tool.
 *
 * These are JSON.stringify'd and injected as an inline <script
 * type="application/ld+json"> in the document <head> via Next.js's
 * app router layout.
 */
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/images/ptlogo.png`,
    description: SITE_DESCRIPTION,
    sameAs: [] as string[],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/home-value?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {jsonLd.map((schema, i) => (
          <script
            key={`ld-json-${i}`}
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>
      <body className={`${fontHeading.variable} ${fontBody.variable} bg-brand-surface text-brand-text font-body`}>
        {/* Skip-to-content — WCAG 2.4.1 "Bypass Blocks" */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#0072ce] focus:shadow-lg focus:ring-2 focus:ring-[#0072ce]/40 dark:focus:bg-slate-900 dark:focus:text-[#4da3e8]"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
