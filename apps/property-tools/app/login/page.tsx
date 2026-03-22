"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import AuthPageShell from "@/components/layout/AuthPageShell";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      let isAgent = false;
      if (user) {
        try {
          const missingUserId = (err: any) => {
            const msg = String(err?.message ?? "");
            return (
              /user_id.*does not exist/i.test(msg) ||
              /column\s+.*user_id.*does not exist/i.test(msg)
            );
          };

          let userRow: any = null;
          let rowErr: any = null;
          ({ data: userRow, error: rowErr } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle());

          if (rowErr && missingUserId(rowErr)) {
            rowErr = null;
          }

          const r = (userRow as { role?: string } | null)?.role;
          if (!rowErr && r === "agent") isAgent = true;
          else if (!rowErr && r === "user") isAgent = false;
          else {
            const { data: agentRow } = await supabase
              .from("agents")
              .select("id")
              .eq("auth_user_id", user.id)
              .maybeSingle();
            isAgent = !!agentRow;
          }
        } catch {
          const { data: agentRow } = await supabase
            .from("agents")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          isAgent = !!agentRow;
        }
      }

      if (isAgent) {
        router.replace("/dashboard");
      } else {
        router.replace(redirectTo.startsWith("/dashboard") ? "/" : redirectTo);
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <Card className="p-6 sm:p-8">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">PropertyTools AI</p>
          <h1 className="font-heading text-xl font-bold text-slate-900 md:text-2xl">Log in</h1>
          <p className="text-sm text-slate-600">Access your agent dashboard and home value leads.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium whitespace-pre-line text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <div className="mt-6 space-y-2 text-center text-[11px] text-slate-500">
          <p>
            New user?{" "}
            <Link href="/signup" className="font-semibold text-[#0072ce] hover:text-[#005ca8]">
              Sign up
            </Link>
          </p>
          <p>
            Real estate agent?{" "}
            <Link href="/agent-signup" className="font-semibold text-[#0072ce] hover:text-[#005ca8]">
              Start free as agent
            </Link>
          </p>
        </div>
      </Card>
    </AuthPageShell>
  );
}
