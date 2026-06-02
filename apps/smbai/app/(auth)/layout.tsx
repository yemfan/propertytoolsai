import type React from "react";
import { HelmLogo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center flex flex-col items-center gap-3">
          <HelmLogo size={48} variant="color" />
          <div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              HelmSmart<span style={{ color: "#1E88E5" }}>.ai</span>
            </span>
            <p className="mt-1 text-sm text-slate-500">More control, less effort</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
