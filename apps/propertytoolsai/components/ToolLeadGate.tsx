"use client";

import { useCallback, useState } from "react";

type ToolLeadGateProps = {
  /** Tool identifier e.g. "mortgage_calculator" */
  tool: string;
  /** Lead source e.g. "mortgage_calculator" */
  source: string;
  /** Intent: buy | sell | refinance | invest */
  intent?: string;
  /** Address if available */
  propertyAddress?: string;
  /** Custom headline */
  title?: string;
  /** Custom description */
  description?: string;
  /** What the user gets after unlocking */
  benefits?: string[];
  /** Called after successful lead capture */
  onUnlocked?: () => void;
  /** Show the gate? */
  show: boolean;
};

const DEFAULT_BENEFITS = [
  "Full detailed breakdown and analysis",
  "Personalized recommendations",
  "Save and share your results",
  "Connect with a local expert",
];

export function ToolLeadGate({
  tool,
  source,
  intent = "buy",
  propertyAddress,
  title = "Get Your Full Report",
  description = "Enter your details to unlock the complete analysis with personalized recommendations.",
  benefits = DEFAULT_BENEFITS,
  onUnlocked,
  show,
}: ToolLeadGateProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(async () => {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/leads/tool-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          source,
          tool,
          intent,
          property_address: propertyAddress || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error || "Failed to submit. Please try again.");
      }

      setDone(true);
      onUnlocked?.();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [name, email, phone, source, tool, intent, propertyAddress, onUnlocked]);

  if (!show || done) return null;

  return (
    <div className="relative">
      {/* Blur overlay on content behind */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-white/60 z-10 backdrop-blur-[2px] rounded-2xl" />

      {/* Lead capture card */}
      <div className="relative z-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Free Report
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
              {description}
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              {benefits.map((b, i) => (
                <li key={i}>
                  <span className="text-blue-500 mr-2">&#10003;</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-gray-50 p-5">
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Phone (optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={!name.trim() || !email.trim() || submitting}
                className="mt-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {submitting ? "Unlocking..." : "Unlock Full Report"}
              </button>

              <p className="text-[10px] text-gray-400 text-center mt-1">
                We respect your privacy. No spam, ever.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
