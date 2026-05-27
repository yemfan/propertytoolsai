import type React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            SMB<span className="text-indigo-600">ai</span>
          </span>
          <p className="mt-1 text-sm text-slate-500">Your all-in-one business suite</p>
        </div>

        {children}
      </div>
    </div>
  );
}
