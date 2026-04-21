# Localization — how to add a new language

This app targets bilingual real-estate agents whose leads are more
comfortable in Spanish, Chinese, or another language. The agent operates
the dashboard in whatever language they prefer; the AI writes to each
lead in the lead's preferred language.

## Design principles

1. **Single source of truth** — `lib/locales/registry.ts`. Adding a
   language is a data change in that file (+ content translations), not
   a code change.
2. **BCP-47 ids on the wire** — `zh`, `zh-CN`, `es-MX`, `en-US`. Stored
   as plain text in the DB. Adding a new language **never** requires a
   DDL migration; previous enum-style CHECK constraints have been
   dropped.
3. **Two independent dimensions per locale**:
   - `outbound.enabled` — whether the AI may write to leads in this
     language. Requires a tone directive + SMS consent copy.
   - `ui.enabled` — whether the dashboard UI may render in this
     language. Requires **100% catalog coverage** (see below).
4. **Legal documents stay in English.** `/terms` and `/privacy` are
   deliberately not translated. Only the SMS opt-in consent checkbox
   copy is localized, because FCC requires consent to be in the
   recipient's language.

## Adding a new language

### Step 1 — Registry entry

Add an entry to `LOCALE_REGISTRY` in `lib/locales/registry.ts` with:

- `id` — the BCP-47 base id (`ja`, `ko`, `es`)
- `bcp47` — full tag with region (`ja-JP`, `es-MX`)
- `label` — English label (for admin / debug surfaces)
- `nativeLabel` — what the switcher button shows the user
- `outbound: { enabled: true }` — as soon as the next two fields are
  written
- `ui: { enabled: false }` — leave off until catalog is 100% covered
- `outboundToneDirective` — the text appended to every outbound AI
  system prompt. Specify register (formal / informal), regional variant
  preferences, taboos, and number / currency formatting quirks. Keep
  under ~600 chars.
- `smsConsentCopy: { version, text }` — TCPA-equivalent consent text
  that will appear next to SMS opt-in checkboxes. **Must be reviewed
  by counsel before shipping to prod.** `version` bumps any time the
  copy materially changes.

### Step 2 — Catalog

Create `messages/<id>.json`, mirroring every key in `messages/en.json`.
Missing keys fall back to English at runtime once next-intl is wired,
so partial coverage is safe — just ensures the user sees some English
mixed in (**which product has explicitly ruled out** — see the `ui.enabled`
rule).

### Step 3 — Content translations

- Drip / canned SMS + email templates: add variants with
  `variant_of = <english_template_id>`, `language = <locale_id>`.
  The app layer's `pickTemplateForLocale()` falls back to the English
  parent when a variant is missing.
- Auto-reply snippets: hunt for any hardcoded strings in
  `lib/ai-sms/safety.ts`, `lib/ai-email/safety.ts`, and similar — any
  message the backend sends without going through the AI path.

### Step 4 — Flip `ui.enabled` (UI launch)

Only after:

- `messages/<id>.json` key set matches `en.json` exactly (run the CI
  check once it exists)
- A bilingual reviewer has eyeballed every translated string
- A bilingual user has run through the main dashboard flows in the
  target language

Flip `ui.enabled` to `true`. The `<LocaleSwitcher>` starts rendering
the language, and users whose `user_profiles.ui_language` equals that
id will see the dashboard render in it.

## Outbound-language-only launches

For most launches the plan is outbound-first, UI-later. That's the
shape zh ships in right now:

- `outbound.enabled: true` — the AI writes to zh-preferred leads in
  Chinese, the `TranslationToggle` lets the English-operating agent
  read inbound Chinese messages, and the SMS consent checkbox uses the
  Chinese copy when a lead is coming in via a Chinese-facing capture
  form.
- `ui.enabled: false` — the agent's dashboard stays English until the
  catalog is complete.

## Wiring next-intl (not yet done)

When `ui.enabled` is ready to flip for any locale, a separate PR adds:

1. `next-intl` to `package.json`
2. `i18n/request.ts` config that reads `user_profiles.ui_language`
   from the session and loads `messages/<locale>.json`, with
   `defaultTranslationValues` pointing at the `en` catalog as fallback.
3. `NextIntlClientProvider` in `app/layout.tsx`, plus setting
   `<html lang>` to the resolved BCP-47.
4. Mount `<LocaleSwitcher>` in the account/settings page.
5. Route handler for `POST /api/user/ui-language` that writes to
   `user_profiles.ui_language` and triggers a reload.

Everything else in this codebase is already localization-safe (it just
passes through the English strings until that PR lands).

## Files in play

| Concern | File |
| --- | --- |
| Registry | `lib/locales/registry.ts` |
| Resolve locale for a lead / UI user | `lib/locales/resolveLocale.ts` |
| Template variant lookup | `lib/locales/templateLookup.ts` |
| On-demand translation service | `lib/locales/translate.ts` |
| Supabase cache adapter | `lib/locales/supabaseTranslationCache.ts` |
| Script / CJK detection | `lib/locales/detectScript.ts` |
| Translation API route | `app/api/translate/route.ts` |
| Inbox translate toggle | `components/crm/TranslationToggle.tsx` |
| (Dormant) UI switcher | `components/locale/LocaleSwitcher.tsx` |
| Message catalog — EN (canonical) | `messages/en.json` |
| Message catalog — ZH | `messages/zh.json` |
