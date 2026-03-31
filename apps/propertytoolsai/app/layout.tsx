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
 * Same pattern as `apps/leadsmartai/app/layout.tsx`: relative `/images/*` icons + `metadataBase`.
 * Tab: `app/icon.png` + `/images/ptlogo64.png`. Apple: `app/apple-icon.png` + `/images/pt-logo180.png`.
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
