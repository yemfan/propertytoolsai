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

/**
 * Favicon order matters for some browsers: `public/favicon.ico` first, then `app/icon.png` (served at `/icon.png`).
 * `app/apple-icon.png` is still picked up by Next automatically for apple-touch-icon.
 */
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "PropertyTools AI",
  description: "Professional real estate calculators for buyers, investors, and agents",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fontHeading.variable} ${fontBody.variable} bg-brand-surface text-brand-text font-body`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
