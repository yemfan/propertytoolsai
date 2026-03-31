import "./globals.css";
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
 * Favicons: use Next file convention only (`app/icon.png`, `app/apple-icon.png`).
 * Do not point `metadata.icons` at `/images/*` — production has returned 404 for `public/images`
 * while `app/icon.png` routes still work (deploy/static output issue).
 */
export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "PropertyTools AI",
  description: "Professional real estate calculators for buyers, investors, and agents",
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
