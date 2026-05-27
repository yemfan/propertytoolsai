"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import type { AuthState } from "@/lib/actions/auth";

export default function SignUpPage() {
  const [state, action, isPending] = useActionState<AuthState, FormData>(
    signUp,
    null
  );

  // After signUp succeeds with email confirmation, the server action returns
  // an "informational" error (Supabase default: confirm your email).
  const isConfirmationMessage = state?.error?.toLowerCase().includes("check your email");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Create your account</h1>
      <p className="text-sm text-slate-500 mb-6">Start your free trial — no credit card required</p>

      <form action={action} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Min. 8 characters"
          />
          <p className="mt-1 text-xs text-slate-400">At least 8 characters</p>
        </div>

        {state?.error && (
          <p
            className={`text-sm rounded-lg px-3 py-2 border ${
              isConfirmationMessage
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-red-600 bg-red-50 border-red-200"
            }`}
          >
            {state.error}
          </p>
        )}

        {!isConfirmationMessage && (
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Creating account…" : "Create account"}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-slate-400">
        By creating an account you agree to our{" "}
        <a href="/terms" className="underline hover:text-slate-600">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-slate-600">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
