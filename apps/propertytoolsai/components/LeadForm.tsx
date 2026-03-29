"use client";

import { useState } from "react";

export default function LeadForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    // TODO: replace with your lead capture API (e.g. Resend, Mailchimp)
    await new Promise((r) => setTimeout(r, 800));
    setStatus("success");
    setEmail("");
  }

  return (
    <section className="bg-primary-600 py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-bold text-white mb-2">
          Stay in the loop
        </h2>
        <p className="text-primary-100 text-sm mb-6">
          Get updates on new tools and AI features.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={status === "loading"}
            className="flex-1 min-w-0 rounded-lg border-0 px-4 py-3 text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-white px-6 py-3 font-semibold text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-70"
          >
            {status === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
        {status === "success" && (
          <p className="mt-3 text-sm text-primary-100">
            Thanks! We&apos;ll keep you updated.
          </p>
        )}
      </div>
    </section>
  );
}
