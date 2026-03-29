"use client";

import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LogoutButton() {
  async function handleLogout() {
    try {
      await supabaseBrowser().auth.signOut();
    } catch (e) {
      console.error(e);
    }
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
    >
      Log Out
    </button>
  );
}
