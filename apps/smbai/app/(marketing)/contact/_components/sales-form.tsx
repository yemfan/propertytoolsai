"use client";

import { useActionState } from "react";
import { submitSalesForm } from "@/lib/actions/sales";
import type { SalesState } from "@/lib/actions/sales";

const interestOptions = [
  { id: "voice", label: "AI Voice Receptionist" },
  { id: "inbox", label: "Smart Inbox" },
  { id: "invoicing", label: "Invoicing & Bookkeeping" },
  { id: "calendar", label: "Calendar & Scheduling" },
  { id: "crm", label: "Client CRM" },
  { id: "all", label: "Full HelmSmart platform" },
];

export default function SalesFormComponent() {
  const [state, action, isPending] = useActionState<SalesState, FormData>(
    submitSalesForm,
    {}
  );

  const isSuccess = state?.success;
  const error = state?.error;

  return (
    <form action={action} className="space-y-6">
      {/* Name & Email */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            disabled={isPending || isSuccess}
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Work email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={isPending || isSuccess}
            placeholder="jane@company.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>

      {/* Company */}
      <div>
        <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
          Company name *
        </label>
        <input
          id="company"
          name="company"
          type="text"
          required
          disabled={isPending || isSuccess}
          placeholder="Your business name"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* What are you interested in? */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What are you interested in? *
        </label>
        <div className="space-y-2">
          {interestOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="interested"
                value={option.id}
                disabled={isPending || isSuccess}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600
                           focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0
                           disabled:opacity-50"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Team size & Timeline */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="teamSize" className="block text-sm font-medium text-gray-700 mb-1">
            Team size
          </label>
          <select
            id="teamSize"
            name="teamSize"
            disabled={isPending || isSuccess}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">Select team size</option>
            <option value="1">Solo / 1 person</option>
            <option value="2-5">2–5 people</option>
            <option value="6-10">6–10 people</option>
            <option value="11-25">11–25 people</option>
            <option value="25+">25+ people</option>
          </select>
        </div>
        <div>
          <label htmlFor="timeline" className="block text-sm font-medium text-gray-700 mb-1">
            Implementation timeline
          </label>
          <select
            id="timeline"
            name="timeline"
            disabled={isPending || isSuccess}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">Select timeline</option>
            <option value="asap">ASAP (this month)</option>
            <option value="q2">Next 1–2 months</option>
            <option value="q3">2–3 months</option>
            <option value="exploring">Just exploring</option>
          </select>
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Anything else we should know?
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          disabled={isPending || isSuccess}
          placeholder="Tell us about your biggest pain point or specific use case..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-500 resize-none"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm text-emerald-700 font-medium">
            ✓ Thanks! Our sales team will reach out within one business day.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || isSuccess}
        className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40
                   disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Submitting…" : isSuccess ? "Inquiry submitted" : "Get a demo"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        * Required fields. We'll follow up with a personalized proposal.
      </p>
    </form>
  );
}
