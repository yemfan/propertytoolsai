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

App Store Connect → App Review → Sign-In Information

- **User name**: `appreview+leadsmart@example.com` (replace with seeded account)
- **Password**: store in 1Password under "LeadSmart App Review"
- **OTP / 2FA**: the seeded account has 2FA disabled. If 2FA is required by
  policy, expose a fixed test code via env flag `LEADSMART_REVIEWER_OTP`.

### What reviewers should test (paste into "Notes")

> LeadSmart is a CRM for licensed real-estate agents. The demo account is a
> seeded agent with sample leads.
>
> Suggested walk-through:
> 1. Sign in with the credentials above.
> 2. Tap the **Inbox** tab — sample lead threads load.
> 3. Open any thread, tap **AI reply** to see a generated SMS draft.
> 4. Tap the **Leads** tab → open any lead → confirm pipeline stage changes.
> 5. Tap the **Settings** tab to verify Privacy / Terms links open in browser
>    and that **Delete account** routes to a confirmation screen (do not
>    confirm — it permanently deletes the demo account).
>
> The app does not handle in-app purchases, child users, or sensitive medical /
> financial data. SMS and email features are sent on behalf of the signed-in
> agent to their own contacts (no cold messaging).

## Account-deletion verification

Apple/Google reviewers test the deletion flow. To exercise it without
destroying the canonical demo account:

1. Sign up a throwaway agent via web (`leadsmart-ai.com/signup`) with a
   `+review` Gmail alias.
2. Sign into the mobile app with that throwaway.
3. Settings → Delete account → type `DELETE` → tap red button.
4. Confirm the user is returned to the login screen and that
   `select id, deleted_at, auth_user_id from agents where id = '<throwaway>'`
   returns `deleted_at` set and `auth_user_id` null.
5. Confirm `auth.users` no longer contains that row.

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
