import "./globals.css";
import { ReactNode } from "react";
import { Montserrat, Roboto } from "next/font/google";
import AuthProvider from "../components/AuthProvider";
import AppShell from "../components/AppShell";

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
  metadataBase: new URL("https://leadsmart-ai.com"),
  title: "LeadSmart AI",
  description: "Professional real estate calculators for buyers, investors, and agents",
  icons: {
    icon: "/images/ls32.png",
    apple: "/images/ls180.png",
    shortcut: "/images/ls32.png",
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
