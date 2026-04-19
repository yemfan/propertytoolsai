"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

type Props = {
  propertyId: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyType?: string;
  photoUrl?: string;
  /** Small = icon only; default = icon + "Save" label. */
  size?: "sm" | "md";
};

type LoadState = "unknown" | "loading" | "not_favorited" | "favorited" | "unauthenticated";

/**
 * Heart toggle for a single listing. On mount, reads the user's
 * favorites to set initial state. Anonymous users see the empty heart
 * and get bounced to sign-in on click.
 *
 * Keeps its own state local (doesn't refetch the whole list on every
 * toggle) — optimistic update + rollback on error.
 */
export function FavoriteButton(props: Props) {
  const [state, setState] = useState<LoadState>("unknown");
  const [favoriteRecordId, setFavoriteRecordId] = useState<string | null>(null);
  const size = props.size ?? "md";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/consumer/favorites", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setState("unauthenticated");
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          favorites?: Array<{ id: string; propertyId: string }>;
        };
        if (!res.ok || !data.ok) {
          setState("not_favorited");
          return;
        }
        const hit = (data.favorites ?? []).find((f) => f.propertyId === props.propertyId);
        if (hit) {
          setFavoriteRecordId(hit.id);
          setState("favorited");
        } else {
          setState("not_favorited");
        }
      } catch {
        if (!cancelled) setState("not_favorited");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.propertyId]);

  async function toggle() {
    if (state === "loading" || state === "unknown") return;
    if (state === "unauthenticated") {
      if (typeof window !== "undefined") {
        const next = encodeURIComponent(window.location.href);
        window.location.href = `/login?next=${next}`;
      }
      return;
    }

    if (state === "favorited") {
      // Optimistic remove
      setState("loading");
      try {
        const res = await fetch(
          `/api/consumer/favorites/${encodeURIComponent(props.propertyId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        setFavoriteRecordId(null);
        setState("not_favorited");
      } catch {
        setState("favorited");
      }
      return;
    }

    // Add
    setState("loading");
    try {
      const res = await fetch("/api/consumer/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: props.propertyId,
          address: props.address,
          city: props.city,
          state: props.state,
          zip: props.zip,
          price: props.price,
          beds: props.beds,
          baths: props.baths,
          sqft: props.sqft,
          propertyType: props.propertyType,
          photoUrl: props.photoUrl,
        }),
      });
      if (res.status === 401) {
        setState("unauthenticated");
        return;
      }
      const data = (await res.json()) as { ok?: boolean; favorite?: { id: string } };
      if (!res.ok || !data.ok) throw new Error("Save failed");
      setFavoriteRecordId(data.favorite?.id ?? null);
      setState("favorited");
    } catch {
      setState("not_favorited");
    }
  }

  const filled = state === "favorited";
  const label =
    state === "unauthenticated"
      ? "Sign in to save"
      : filled
        ? "Saved"
        : "Save";

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={filled}
        disabled={state === "loading" || state === "unknown"}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
          filled
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
        } disabled:opacity-60`}
      >
        <Heart
          className="h-4 w-4"
          strokeWidth={filled ? 0 : 2}
          fill={filled ? "currentColor" : "none"}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === "loading" || state === "unknown"}
      aria-pressed={filled}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${
        filled
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      } disabled:opacity-60`}
    >
      <Heart
        className="h-4 w-4"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? "currentColor" : "none"}
      />
      {label}
    </button>
  );
}
