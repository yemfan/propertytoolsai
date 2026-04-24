"use client";

import { useEffect } from "react";

const STORAGE_KEY = "leadsmart.referral_code";

/**
 * Thin client component that watches for `?ref=CODE` on page load
 * and stashes it in localStorage so we can redeem it later, once the
 * user is authenticated (complete-profile page). Drop this at the
 * root of the marketing shell — invisible, no markup.
 *
 * Also strips `?ref=` from the URL after capture so sharing the
 * resulting URL (or refreshing) doesn't re-show a ref from a
 * previous visitor.
 */
export function ReferralCodeCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (!ref) return;
      const clean = ref.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,16}$/.test(clean)) return;
      window.localStorage.setItem(STORAGE_KEY, clean);
      // Strip the param from the URL — visual cleanup + prevents
      // a refresh from overwriting a later capture.
      url.searchParams.delete("ref");
      const next = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
      window.history.replaceState({}, "", next);
    } catch {
      /* localStorage disabled or SSR context — no-op */
    }
  }, []);
  return null;
}

/**
 * Reads + clears the stashed referral code. Call from
 * complete-profile after the user's profile is saved. Returns null
 * if no code is stashed.
 */
export function consumeStashedReferralCode(): string | null {
  try {
    const code = window.localStorage.getItem(STORAGE_KEY);
    if (code) window.localStorage.removeItem(STORAGE_KEY);
    return code;
  } catch {
    return null;
  }
}
