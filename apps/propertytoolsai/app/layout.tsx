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

const siteOrigin = getSiteUrl();

/** Absolute asset URLs — avoids relying on `metadataBase` resolution for icons (more reliable with www + Vercel). */
function absPath(path: string): string {
  return new URL(path, `${siteOrigin}/`).href;
}

/**
 * Same pattern as LeadSmart (`metadata` + `icons`). Icon URLs are absolute so they match the public
 * domain even when `metadataBase` handling differs between Next versions or deploy modes.
 */
export const metadata = {
  metadataBase: new URL(siteOrigin),
  title: "PropertyTools AI",
  description: "Professional real estate calculators for buyers, investors, and agents",
  icons: {
    icon: [{ url: absPath("/images/ptlogo64.png"), sizes: "64x64", type: "image/png" }],
    shortcut: absPath("/images/ptlogo64.png"),
    apple: [{ url: absPath("/images/pt-logo180.png"), sizes: "180x180", type: "image/png" }],
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
