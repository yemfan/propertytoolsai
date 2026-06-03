import "./globals.css";
import "@helm/ui/tokens";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getActivePack } from "@/lib/packs";

const fontBody = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const pack = await getActivePack();
  return {
    title: {
      default: pack.productName,
      template: `%s | ${pack.productName}`,
    },
    description:
      "More control, less effort — AI-powered front office for small businesses.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pack = await getActivePack();
  return (
    <html lang="en" data-pack={pack.dataPack}>
      <body
        className={`${fontBody.variable} ${fontMono.variable} antialiased bg-slate-50 text-slate-900`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
