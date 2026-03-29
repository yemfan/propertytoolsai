# LeadSmart mobile push notifications

## Registration (Expo → LeadSmart)

- **HTTP**: `POST /api/mobile/push/register`
- **Auth**: Same session as other mobile routes — `Authorization: Bearer <Supabase JWT>` (or cookie session).
- **Body** (`MobilePushRegisterRequestDto`):

```json
{
  "expoPushToken": "ExponentPushToken[…]",
  "platform": "ios | android | web | unknown",
  "deviceId": null,
  "appVersion": "1.0.0"
}
```

- **Storage**: `public.mobile_push_tokens` — unique on `(user_id, expo_push_token)`; `agent_id` set from the authenticated agent row.

## Service layer (`apps/leadsmartai`)

| Module | Role |
|--------|------|
| `lib/mobile/pushNotificationsService.ts` | Public barrel: register + all dispatch helpers |
| `lib/mobile/push.ts` | Upsert token (Supabase admin) |
| `lib/mobile/pushTokens.ts` | List Expo tokens for a `user_id` |
| `lib/mobile/expoPushSend.ts` | HTTP client for Expo Push API |
| `lib/mobile/pushDispatch.ts` | Domain dispatchers + dedupe via `lead_events` |

## Outbound payload contract

Expo messages use **`data` as string key/value pairs only** (APNs/FCM friendly).

| `data.kind` | When | `title` (typical) | `data` fields |
|-------------|------|-------------------|---------------|
| `hot_lead` | Hot lead / high-intent SMS or email agent alert (`notifyAgentOfHotLead` + mobile path) | `Hot lead — LeadSmart` | `leadId`, `kind` |
| `inbound_sms` | Inbound SMS stored for a lead (not unsubscribe) | `New SMS — LeadSmart` | `leadId`, `kind` |
| `inbound_email` | Inbound email logged for assigned lead | `New email — LeadSmart` | `leadId`, `kind` |
| `needs_human` | AI SMS/email reply flagged `needsHuman` or tag `human_escalation` | `AI needs you — LeadSmart` | `leadId`, `kind`, `channel` (`sms` \| `email`), `reason` |
| `reminder` | Follow-up due (`next_contact_at`) — `GET /api/cron/lead-followups` | `Follow-up due — LeadSmart` | `leadId`, `kind` |

Optional future fields: keep values **strings** (e.g. `threadId`).

## Server environment

| Variable | Purpose |
|----------|---------|
| `EXPO_ACCESS_TOKEN` | Expo push API auth (recommended in production) |
| `MOBILE_PUSH_ENABLED=false` | Disable all mobile pushes |
| `MOBILE_PUSH_HOT_LEAD=false` | Disable hot-lead pushes |
| `MOBILE_PUSH_INBOUND_SMS=false` | Disable inbound SMS pushes |
| `MOBILE_PUSH_INBOUND_EMAIL=false` | Disable inbound email pushes |
| `MOBILE_PUSH_NEEDS_HUMAN=false` | Disable AI “needs human” pushes |
| `MOBILE_PUSH_REMINDER=false` | Disable follow-up reminder pushes |

## Dedupe / telemetry

- Inbound SMS/email: `lead_events.event_type` `mobile_push_inbound_sms` / `mobile_push_inbound_email` (2 min window).
- Needs human: `mobile_push_needs_human` (3 min window).
- Hot lead mobile: `mobile_push_hot_lead`; coordinated with SMS agent notify via `hot_lead_agent_sms_sent` + `mobile_push_hot_lead` in `notifyAgentOfHotLead` dedupe (see `lib/ai-sms/notifications.ts`).
- Reminder: `mobile_push_reminder` (at most ~1× per lead per 24h).

## Client types

`@leadsmart/shared`: `MobilePushNotificationKind`, `MobilePushNotificationData`, `MobilePushRegisterRequestDto`.

## Realtime (Expo inbox + lead detail)

Migration `20260460000000_mobile_message_realtime_rls.sql` enables **RLS SELECT** on `sms_messages`, `email_messages`, and `sms_conversations` for `authenticated` users whose `agents.auth_user_id` matches `auth.uid()` and owns the lead. Those tables are added to **`supabase_realtime`** so the mobile app can subscribe with the same Supabase JWT used for REST.

The Next.js dashboard continues to use the service role or existing session clients; **service role bypasses RLS**.
