import "./globals.css";
import { ReactNode } from "react";
import { Montserrat, Roboto } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
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
    images: [
      {
        url: `${SITE_URL}/images/og-default.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — AI Real Estate Lead Management`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/images/og-default.png`],
    creator: "@leadsmartai",
  },
  icons: {
    icon: [{ url: "/images/lslog64.png", sizes: "64x64", type: "image/png" }],
    shortcut: "/images/lslog64.png",
    apple: [{ url: "/images/ls180.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fontHeading.variable} ${fontBody.variable} bg-brand-surface text-brand-text font-body`}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
