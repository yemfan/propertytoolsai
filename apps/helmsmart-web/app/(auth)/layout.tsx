import type React from "react";
import { LogoMark } from "@helm/ui";
import { getActivePack } from "@/lib/packs";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pack-aware brand: DoctorSmart on doctor.*/medical.*, HelmSmart elsewhere.
  const pack = await getActivePack();
  const baseName = pack.productName.replace(/(\s+AI|\.ai)$/i, "");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark — driven by the active pack manifest */}
        <div className="mb-8 text-center flex flex-col items-center gap-3">
          <LogoMark letter={pack.logoLetter} size={48} />
          <div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {baseName}<span style={{ color: "var(--brand)" }}>.ai</span>
            </span>
            {pack.tagline && (
              <p className="mt-1 text-sm text-slate-500">{pack.tagline}</p>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
