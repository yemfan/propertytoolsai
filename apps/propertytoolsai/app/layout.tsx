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

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "PropertyTools AI",
  description: "Professional real estate calculators for buyers, investors, and agents",
  /**
   * Favicons: `app/icon.png` + `app/apple-icon.png` (Next file convention), plus explicit links so
   * browsers and previews resolve the same URLs as `metadataBase` (Vercel / Linux).
   */
  icons: {
    icon: [
      { url: "/images/ptlog64.png", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/images/ptlog64.png",
    apple: [
      { url: "/images/pt-logo180.png", sizes: "180x180", type: "image/png" },
    ],
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
