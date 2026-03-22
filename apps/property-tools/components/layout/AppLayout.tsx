"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { AccessProvider } from "@/components/AccessProvider";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isMarketingHome = pathname === "/";

  if (isMarketingHome) {
    return (
      <AccessProvider>
        <div className="min-h-screen bg-white text-slate-900">{children}</div>
      </AccessProvider>
    );
  }

  return (
    <AccessProvider>
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <div className="min-h-screen min-w-0 lg:ml-60">
        <Topbar onMenuClick={() => setMobileOpen((prev) => !prev)} />
        <main className="min-w-0 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
    </AccessProvider>
  );
}

