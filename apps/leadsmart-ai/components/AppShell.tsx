"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import FloatingCTA from "./FloatingCTA";

/**
 * Public comparison reports use a minimal chrome (no sidebar) for client-facing PDF/share UX.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPublicReport = pathname.startsWith("/report/");
  /** Marketing homepage: full-bleed landing (no sidebar / app chrome). */
  const isMarketingHome = pathname === "/";

  if (isPublicReport) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  if (isMarketingHome) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-8">{children}</main>
        <Footer />
      </div>
      <FloatingCTA />
    </div>
  );
}
