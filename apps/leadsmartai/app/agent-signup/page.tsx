"use client";

import { Suspense } from "react";
import { AgentSignupForm } from "@/components/agent-signup/AgentSignupForm";

export default function AgentSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <AgentSignupForm layout="page" />
    </Suspense>
  );
}
