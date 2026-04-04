"use client";

import { useEffect } from "react";

/** Legacy path — recovery emails now use `/reset-password`; preserve hash/query for Supabase tokens. */
export default function LegacyAuthResetPasswordRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname === "/auth/reset-password") {
      window.location.replace(`/reset-password${search}${hash}`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <p className="text-sm text-slate-600">Redirecting…</p>
    </div>
  );
}
