"use client";

import { Search } from "lucide-react";
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
      className={`flex min-w-0 flex-1 max-w-xl ${className}`}
      role="search"
    >
      <label htmlFor="pt-global-search" className="sr-only">
        Search tools and guides
      </label>
      <div className="flex h-11 w-full min-w-0 items-center gap-3 rounded-2xl border border-gray-200/90 bg-gray-50/90 px-3.5 shadow-sm transition-colors focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-md md:px-4">
        <Search className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
        <input
          id="pt-global-search"
          name="q"
          type="search"
          enterKeyHint="search"
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
      </div>
    </form>
  );
}
