"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthPageShell from "@/components/layout/AuthPageShell";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function AgentSignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [email, setEmail] = useState("");
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
    if (!phone.trim()) return setError("Phone is required for agent onboarding.");
    if (!isValidUsPhone(phone)) {
      return setError("Phone must be a valid US number (10 digits).");
    }
    if (!password.trim() || password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const digits = phone.replace(/\D/g, "");
      const e164 = `+1${digits}`;

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), phone_e164: e164 },
        },
      });

      if (signUpErr) throw signUpErr;

      const userId = data?.user?.id;
      if (!userId) {
        setSuccess("Check your email to confirm your account, then log in to use PropertyTools AI.");
        return;
      }

      const emailTrim = email.trim();

      if (data.session) {
        const { error: phoneErr } = await supabase.auth.updateUser({
          phone: e164,
          data: { full_name: fullName.trim() },
        });
        if (phoneErr) throw phoneErr;
      }

      const { error: upsertUserErr1 } = await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          full_name: fullName.trim(),
          phone: e164,
          email: emailTrim,
        },
        { onConflict: "user_id" }
      );
      if (upsertUserErr1) throw upsertUserErr1;

      const { error: lsErr } = await supabase.from("leadsmart_users").upsert(
        {
          user_id: userId,
          role: "agent",
          license_number: licenseNumber.trim() || null,
          brokerage: brokerage.trim() || null,
        },
        { onConflict: "user_id" }
      );
      if (lsErr) throw lsErr;

      const { error: ptErr } = await supabase.from("propertytools_users").upsert(
        { user_id: userId, tier: "basic" },
        { onConflict: "user_id" }
      );
      if (ptErr) throw ptErr;

      // 2) Create agent row for CRM / API features that scope by agent id.
      // Keep inserts limited to known columns (auth_user_id + plan_type).
      const { error: upsertAgentErr } = await supabase.from("agents").upsert(
        {
          auth_user_id: userId,
          plan_type: "free",
        } as any,
        { onConflict: "auth_user_id" }
      );
      if (upsertAgentErr) throw upsertAgentErr;

      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/me/profile", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ signup_origin_app: "propertytools" }),
        });
      }

      router.push("/");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/rate limit|too many requests/i.test(msg)) {
        setError(
          "Too many emails sent. Wait before retrying, or in Supabase Dashboard → Authentication → Providers → Email: disable “Confirm email” while testing, or connect custom SMTP."
        );
      } else if (/confirmation email|confirm email/i.test(msg)) {
        setError(
          "Supabase couldn’t send the confirmation email. For local testing, disable email confirmations in Supabase Dashboard (Authentication → Email/Providers → turn off Confirm email). If you want emails, check Supabase SMTP/Resend settings and that the sender domain is verified."
        );
      } else {
        setError(msg || "Agent signup failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell wide>
      <Card className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">Agents</p>
          <h1 className="font-heading text-xl font-bold text-slate-900 md:text-2xl">Start free as agent</h1>
          <p className="text-sm text-slate-600">CMA tools, calculators, and lead-ready workflows.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Name</label>
            <Input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Phone</label>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatUsPhone(e.target.value))}
              placeholder="(Required) Agent alerts + follow-ups"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">License number (optional)</label>
            <Input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Brokerage (optional)</label>
            <Input type="text" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
            {loading ? "Creating agent…" : "Create agent account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Prefer regular user signup?{" "}
          <Link href="/signup" className="font-semibold text-[#0072ce] hover:text-[#005ca8]">
            Sign up here
          </Link>
        </p>
      </Card>
    </AuthPageShell>
  );
}

