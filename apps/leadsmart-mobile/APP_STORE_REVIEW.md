# LeadSmart mobile — store review checklist

Owner: Michael Ye. Last updated: 2026-05-26.

This doc tracks the work needed to pass Apple App Store and Google Play review
for `apps/leadsmart-mobile` (bundle `ai.leadsmart.mobile`, version 1.5.0).

## Status

| Area | State | Notes |
|---|---|---|
| Account deletion (in-app) | ✅ | Settings → Delete account → confirmation. `DELETE /api/mobile/account`. |
| Account deletion (web) | ✅ | https://leadsmart-ai.com/delete-account — public, no install required. |
| Privacy policy link in-app | ✅ | Settings → Legal → Privacy policy. |
| Terms of service link in-app | ✅ | Settings → Legal → Terms of service. |
| `supportsTablet` | ✅ | Set to `false` — iPhone-only for v1; revisit before iPad rollout. |
| Push permission rationale | ✅ | `app/(onboarding)/notifications.tsx` shows rationale screen before prompt. |
| Sign in with Apple | ✅ | Required because Google OAuth is offered. Implemented in `lib/oauthMobile.ts`. |
| Camera / Photo permission strings | ✅ | `app.json` infoPlist + expo-image-picker plugin. |
| Export compliance | ✅ | `ITSAppUsesNonExemptEncryption: false`. |
| EAS submit config | ⚠️ | Placeholders in `eas.json`. Fill before first submit. |
| App Privacy / Data Safety form | ⏳ | Manual — App Store Connect + Play Console. |
| Screenshots + metadata | ⏳ | Manual — App Store Connect + Play Console. |

## Filling the EAS submit config

Edit `eas.json` `submit.production`:

- **iOS**
  - `appleId`: Apple ID email of the account that owns the app record in
    App Store Connect.
  - `ascAppId`: numeric "Apple ID" from App Store Connect → App Information.
  - `appleTeamId`: 10-character Team ID from
    https://developer.apple.com/account#MembershipDetailsCard.
- **Android**
  - `serviceAccountKeyPath`: path to the Google Play service account JSON.
    Download from Play Console → Setup → API access → Service accounts → keys.
    Drop the file at `apps/leadsmart-mobile/eas-play-service-account.json`
    and add it to `.gitignore` (it is a credential).
  - `track`: starts at `internal`. Change to `production` for the live rollout.

Alternatively, store credentials in EAS Dashboard rather than `eas.json` — leave
the file as placeholders and run `eas credentials` once to upload.

## Reviewer demo account

Provisioned in prod Supabase (`babmbowmzwizoahkmshx`) by
[`scripts/seed-app-review-demo-account.mjs`](../leadsmartai/scripts/seed-app-review-demo-account.mjs)
and verified end-to-end by
[`scripts/verify-app-review-demo-signin.mjs`](../leadsmartai/scripts/verify-app-review-demo-signin.mjs).

- **Email**: `demo@leadsmart.ai`
- **Password**: `Demo123!`
- **2FA / OTP**: none — email/password sign-in.
- **`auth.users.id`**: `03762a82-d1d1-4ddd-bab7-0519f4a11d6c`
- **`agents.id`**: `31` — `plan_type: pro`, brand "LeadSmart Demo", 3 demo
  leads (Sarah Chen, Marcus Reyes, Priya Iyer).

> History: Apple rejected build 1.0.0 (1) on **2026-04-02** under
> **Guideline 2.1** because the reviewer could not sign in — the demo
> account had not yet been created. Provisioned on 2026-05-27. Re-test
> with `node ./scripts/verify-app-review-demo-signin.mjs` before each
> submission.

### Paste into App Store Connect → App Information → App Review → App Review Information

**Sign-In required: Yes**

**Username**: `demo@leadsmart.ai`
**Password**: `Demo123!`

**Notes** (replace any prior "Access Token" content):

> LeadSmart is a CRM for licensed real-estate agents. The demo account
> above is a seeded test agent with three sample leads. Email/password
> sign-in only — no OTP, no SMS verification.
>
> Suggested walk-through:
> 1. Tap **Sign in with email** on the welcome screen.
> 2. Enter `demo@leadsmart.ai` / `Demo123!` and tap **Continue**.
> 3. **Inbox** tab — sample lead threads load (may be empty on first
>    submission; the **Leads** tab below shows the seeded content).
> 4. **Leads** tab — three demo leads. Tap any lead to view detail,
>    pipeline stage, and AI-reply controls.
> 5. **Settings** tab — verify **Privacy policy** and **Terms of
>    service** open in the browser. **Delete account** routes to a
>    typed-confirmation screen; do NOT confirm (it permanently deletes
>    the demo account).
>
> The app does not handle in-app purchases, child users, or sensitive
> medical / financial data. SMS and email features are sent on behalf of
> the signed-in agent to their own contacts — there is no cold messaging
> or unsolicited outreach.

## Account-deletion verification

Apple/Google reviewers test the deletion flow. To exercise it without
destroying the canonical demo account (`demo@leadsmart.ai` / `Demo123!`):

1. Sign up a throwaway agent via web (`leadsmart-ai.com/signup`) with a
   `+review` Gmail alias.
2. Sign into the mobile app with that throwaway.
3. Settings → Delete account → type `DELETE` → tap red button.
4. Confirm the user is returned to the login screen and that
   `select id, deleted_at, auth_user_id from agents where id = '<throwaway>'`
   returns `deleted_at` set and `auth_user_id` null.
5. Confirm `auth.users` no longer contains that row.

If the reviewer accidentally deletes the demo account, re-provision with
`node ./apps/leadsmartai/scripts/seed-app-review-demo-account.mjs`
(idempotent — restores password and seeds leads).

## Open items before first submit

- [ ] Fill `eas.json` submit IDs (see above).
- [ ] Seed and document the reviewer demo account.
- [ ] Fill App Privacy nutrition labels in App Store Connect.
- [ ] Fill Data Safety form in Play Console.
- [ ] Generate 3+ screenshots per device class (iPhone 6.9", iPhone 6.5",
      Android phone). Skip iPad — `supportsTablet: false`.
- [ ] Confirm app icon master is 1024×1024, opaque PNG, no rounded corners.
- [ ] Build production binary: `eas build -p all --profile production`.
- [ ] Submit: `eas submit -p ios --profile production` and
      `eas submit -p android --profile production`.

## Post-launch follow-ups

- Hard-purge sweeper job: a scheduled function that hard-deletes agent rows
  (and downstream lead / conversation / showing data) once `deleted_at` is
  older than the grace window. Currently we mark + detach; data lingers
  until the sweeper ships. Track in a separate task.
- Add `/account/delete` redirect from the marketing footer for
  discoverability. Currently only linked from the Privacy Policy.
