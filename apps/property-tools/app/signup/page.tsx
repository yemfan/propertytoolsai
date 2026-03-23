"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import AuthPageShell from "@/components/layout/AuthPageShell";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function formatUsPhone(input: string) {
    const digits = input.replace(/\D/g, "").slice(0, 10);
    if (!digits) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function isValidUsPhone(input: string) {
    const digits = input.replace(/\D/g, "");
    return digits.length === 10;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!fullName.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (phone.trim() && !isValidUsPhone(phone)) {
      return setError("Phone must be a valid US number (10 digits) if provided.");
    }
    if (!password.trim() || password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signUpErr) throw signUpErr;
      const userId = data?.user?.id;
      if (!userId) {
        setSuccess("Check your email to confirm your account, then come back to log in.");
        return;
      }

      const { error: upsertErr1 } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          role: "user",
          full_name: fullName.trim(),
          phone: phone.trim() ? phone.trim() : null,
        },
        { onConflict: "user_id" }
      );

      if (upsertErr1) {
        const msg = String(upsertErr1?.message ?? "");
        const missingUserId = /user_id.*does not exist|column\s+.*user_id.*does not exist/i.test(
          msg
        );

        if (missingUserId) {
          // no-op for backwards compatibility: `user_profiles` always uses `user_id`
        } else {
          throw upsertErr1;
        }
      }

      router.push("/");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/rate limit|too many requests/i.test(msg)) {
        setError(
          "Too many emails sent from this app. Wait an hour or use a different email. In Supabase: Auth → turn off “Confirm email” for dev, or add custom SMTP for production."
        );
      } else if (/confirmation email|confirm email/i.test(msg)) {
        setError(
          "Supabase couldn’t send the confirmation email. For local testing, disable email confirmations in Supabase Dashboard (Authentication → Email/Providers → turn off Confirm email). If you want emails, check Supabase SMTP/Resend settings and that the sender domain is verified."
        );
      } else {
        setError(msg || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <Card className="p-6 sm:p-8">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">PropertyTools AI</p>
          <h1 className="font-heading text-xl font-bold text-slate-900 md:text-2xl">Create your account</h1>
          <p className="text-sm text-slate-600">Get started on the main site. Agents unlock premium tools and saved reports.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Name</label>
            <Input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Phone</label>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatUsPhone(e.target.value))}
              placeholder="(Optional) SMS alerts"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium whitespace-pre-line text-red-700">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
              {success}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Creating account…" : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0072ce] hover:text-[#005ca8]">
            Log in
          </Link>
        </p>
      </Card>
    </AuthPageShell>
  );
}
