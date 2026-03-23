"use client";

import { FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Tool discovery: sends users to guides with an optional query.
 */
export default function GlobalSearchBar({
  className = "",
  placeholder = "Search tools & guides…",
}: {
  className?: string;
  /** Shown in the search input (e.g. address / city copy for marketing). */
  placeholder?: string;
}) {
  const router = useRouter();

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const q = String(fd.get("q") ?? "").trim();
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      router.push(`/guides${params.toString() ? `?${params}` : ""}`);
    },
    [router]
  );

  return (
    <form
      onSubmit={onSubmit}
      className={`relative min-w-0 flex-1 max-w-xl ${className}`}
      role="search"
    >
      <label htmlFor="pt-global-search" className="sr-only">
        Search tools and guides
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        id="pt-global-search"
        name="q"
        type="search"
        enterKeyHint="search"
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </form>
  );
}
