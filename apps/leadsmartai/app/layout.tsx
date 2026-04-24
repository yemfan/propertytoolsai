import "./globals.css";
import { ReactNode } from "react";
import { Montserrat, Roboto } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";
import { CookieConsentProvider } from "@/components/cookie-consent/CookieConsent";
import { ReferralCodeCapture } from "@/components/referrals/ReferralCodeCapture";
import { getSiteUrl } from "@/lib/siteUrl";

const fontHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700", "800"],
  display: "swap",
});

const fontBody = Roboto({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
  display: "swap",
});

import type { Metadata } from "next";

const SITE_URL = getSiteUrl().replace(/\/$/, "");
const SITE_NAME = "LeadSmart AI";
const SITE_DESCRIPTION =
  "AI-powered real estate lead management, smart CRM, and automated follow-ups for top-producing agents.";

/**
 * Tab: `app/icon.png` + `/images/lslog64.png`. Apple: `app/apple-icon.png` + `/images/ls180.png`.
 * Explicit entries ensure correct absolute URLs with `metadataBase` on Vercel previews.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "real estate CRM",
    "AI lead management",
    "real estate agent software",
    "lead follow-up automation",
    "property lead scoring",
    "real estate email automation",
    "smart CRM for agents",
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
    // never existed on disk, so every social share had a broken preview
    // (same bug that existed on PropertyTools AI until PR #17).
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // Same as openGraph.images — Next auto-picks up opengraph-image.tsx
    // for twitter:image as well.
    creator: "@leadsmartai",
  },
  icons: {
    icon: [{ url: "/images/lslog64.png", sizes: "64x64", type: "image/png" }],
    shortcut: "/images/lslog64.png",
    apple: [{ url: "/images/ls180.png", sizes: "180x180", type: "image/png" }],
  },
  // NOTE: Do NOT set a root-level canonical here. Next.js merges root
  // layout metadata into every child page that doesn't override it,
  // which causes all subpages (e.g. /about, /pricing, /blog) to emit
  // <link rel="canonical" href="https://www.leadsmart-ai.com/"> —
  // telling Google every page is a duplicate of the homepage.
  // Individual pages should set their own canonical via generateMetadata.
  alternates: {},
};

/**
 * JSON-LD structured data for Google rich results. Three graphs:
 *
 *   1. Organization — brand identity, logo, name. Surfaces as the
 *      knowledge panel + logo in search results.
 *
 *   2. WebSite with SearchAction — enables the "Sitelinks search box"
 *      in Google SERPs pointing at /dashboard/leads for quick agent
 *      access.
 *
 *   3. SoftwareApplication — describes LeadSmart AI as a real estate
 *      CRM product with an offer ladder (Free / Pro / Elite / Team).
 *      AggregateRating is intentionally omitted because we don't yet
 *      have real review data — adding fake ratings gets penalized.
 *
 * Injected as inline <script type="application/ld+json"> tags in the
 * document <head> via Next.js App Router layout.
 */
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/images/lslog64.png`,
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
        urlTemplate: `${SITE_URL}/dashboard/leads?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "199",
      offerCount: "4",
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
        {/*
         * Skip-to-content link — WCAG 2.4.1 "Bypass Blocks".
         * Hidden by default with `sr-only`, becomes visible on
         * keyboard focus via `focus:not-sr-only` so sighted
         * keyboard users can jump past the nav. Points at
         * `#main-content` which lives on the `<main>` element
         * in `LeadSmartLanding.tsx` and `DashboardShell.tsx`.
         */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#0072ce] focus:shadow-lg focus:ring-2 focus:ring-[#0072ce]/40 dark:focus:bg-slate-900 dark:focus:text-[#4da3e8]"
        >
          Skip to content
        </a>
        <AuthProvider>
          <CookieConsentProvider>
            <ReferralCodeCapture />
            <AppShell>{children}</AppShell>
          </CookieConsentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
