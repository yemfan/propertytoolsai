"use client";

/**
 * Feature-flagged language switcher (dormant until the catalog is fully
 * populated).
 *
 * Lists every locale with `ui.enabled === true` in the locale registry.
 * Because `zh.ui.enabled` is currently `false` until the message catalog
 * hits 100% coverage, the registry's `listUiEnabled()` currently returns
 * only English and this component renders as a no-op. The flip:
 *
 *   1. Translation vendor finishes `messages/zh.json` for every key in
 *      `messages/en.json`.
 *   2. next-intl is wired into `app/layout.tsx` with fallback locale 'en'.
 *   3. `zh.ui.enabled` flips to `true` in `lib/locales/registry.ts`.
 *   4. Users see the switcher and can pick Chinese.
 *
 * Intentionally NOT rendered anywhere in this PR. The component is
 * shipped so the follow-up PR that does the wiring can drop it into the
 * settings or account page without re-designing the UX.
 */

import { useEffect, useState } from "react";
import { listUiEnabled, type LocaleId } from "@/lib/locales/registry";

type Props = {
  /** Current user's ui_language (from user_profiles). Null → 'en'. */
  currentLocale: LocaleId | null;
  /**
   * Called when the user picks a new locale. The caller is responsible
   * for persisting it (POST to an API route that writes
   * user_profiles.ui_language) and triggering whatever reload behavior
   * the app wants (full reload is cheapest + safest).
   */
  onChange: (locale: LocaleId) => Promise<void> | void;
};

export function LocaleSwitcher({ currentLocale, onChange }: Props) {
  const options = listUiEnabled();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<LocaleId>(currentLocale ?? "en");

  // Keep selection in sync if the parent re-fetches user profile.
  useEffect(() => {
    setSelected(currentLocale ?? "en");
  }, [currentLocale]);

  // With only one ui-enabled locale there's nothing to switch between;
  // rendering nothing keeps settings pages uncluttered until zh is ready.
  if (options.length <= 1) return null;

  async function pick(id: LocaleId) {
    if (id === selected || pending) return;
    setPending(true);
    setSelected(id);
    try {
      await onChange(id);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      {options.map((o) => {
        const active = o.id === selected;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              void pick(o.id);
            }}
            disabled={pending}
            aria-pressed={active}
            lang={o.bcp47}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            } disabled:opacity-60`}
          >
            {o.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
