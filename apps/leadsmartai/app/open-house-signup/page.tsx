"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSignupProfilePrefill, type SignupPrefillConsumer } from "@/lib/hooks/useSignupProfilePrefill";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OpenHouseSignupPage() {
  return (
    <Suspense fallback={null}>
      <OpenHouseSignupPageInner />
    </Suspense>
  );
}

function OpenHouseSignupPageInner() {
  const searchParams = useSearchParams();
  const propertyId = searchParams?.get("property_id") ?? "";
  const agentId = searchParams?.get("agent_id") ?? "";

  const { values: prefill, loading: prefillLoading } = useSignupProfilePrefill("consumer");
  const pv = prefill as SignupPrefillConsumer;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [wantMoreInfo, setWantMoreInfo] = useState(false);
  const [wantSimilar, setWantSimilar] = useState(false);
  const [wantValuation, setWantValuation] = useState(false);

  useEffect(() => {
    if (prefillLoading) return;
    setName((n) => (n.trim() ? n : pv.fullName));
    setEmail((e) => (e.trim() ? e : pv.email));
    setPhone((p) => (p.trim() ? p : pv.phone));
  }, [prefillLoading, pv]);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [message]);

  const title = useMemo(() => {
    return propertyId
      ? "Sign up for Open House Updates"
      : "Sign up for Open House Updates";
  }, [propertyId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!propertyId) {
      setMessage({ type: "error", text: "Missing property_id in the signup link." });
      return;
    }
    if (!name.trim()) {
      setMessage({ type: "error", text: "Name is required." });
      return;
    }
    if (!email.trim()) {
      setMessage({ type: "error", text: "Email is required." });
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    if (!phone.trim()) {
      setMessage({ type: "error", text: "Phone is required." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/open-house-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          notes: notes.trim() ? notes : undefined,
          property_id: propertyId,
          agent_id: agentId || undefined,
          preferences: {
            want_more_info: wantMoreInfo,
            want_similar_properties: wantSimilar,
            want_home_valuation: wantValuation,
          },
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res.ok || !payload?.success) {
        setMessage({
          type: "error",
          text: payload?.message || "Something went wrong submitting your signup.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: payload.message || "Thanks! We will be in touch shortly.",
      });

      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
    } catch (err) {
      console.error("Open house signup failed", err);
      setMessage({
        type: "error",
        text: "Network error submitting your signup. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">
              Leave your info and we will follow up with open house updates.
            </p>
          </div>

          <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Name
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Phone
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Notes (optional)
              </label>
              <textarea
                className="mt-1 w-full min-h-[100px] rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything you'd like the agent to know?"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">I&apos;m interested in:</p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={wantMoreInfo} onChange={(e) => setWantMoreInfo(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                More information about this property
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={wantSimilar} onChange={(e) => setWantSimilar(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Similar properties on the market
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={wantValuation} onChange={(e) => setWantValuation(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                A home valuation for my property
              </label>
            </div>

            <input type="hidden" name="property_id" value={propertyId} />

            <button
              disabled={submitting}
              type="submit"
              className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </form>

          {message ? (
            <div
              ref={messageRef}
              className={
                "mt-4 rounded-xl px-4 py-3 text-sm " +
                (message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200")
              }
              role={message.type === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {message.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

