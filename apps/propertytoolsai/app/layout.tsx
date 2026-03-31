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
 * Same pattern as `apps/leadsmartai/app/layout.tsx`: Metadata API only (no manual `<head>`).
 * Manual `<head>` in the App Router is easy for Next to drop or merge incorrectly.
 *
 * `metadataBase` uses `NEXT_PUBLIC_SITE_URL` at **build** time — change the env in Vercel, then **redeploy**
 * so the client bundle and metadata pick it up.
 */
export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "PropertyTools AI",
  description: "Professional real estate calculators for buyers, investors, and agents",
  icons: {
    icon: [{ url: "/images/ptlogo64.png", sizes: "64x64", type: "image/png" }],
    shortcut: "/images/ptlogo64.png",
    apple: [{ url: "/images/pt-logo180.png", sizes: "180x180", type: "image/png" }],
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
