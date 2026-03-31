import type { ReactNode } from "react";

/** Prevents static prerender at build when Supabase public env vars are unset (e.g. Vercel without env). */
export const dynamic = "force-dynamic";

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
