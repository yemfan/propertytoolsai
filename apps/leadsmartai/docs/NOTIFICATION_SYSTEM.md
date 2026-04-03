# LeadSmart notification system

Production-oriented notifications for the CRM mobile app: **in-app inbox** (Postgres), **Expo push**, **per-agent preferences**, and **batched low-priority reminders**.

## 1. Schema

| Object | Purpose |
|--------|---------|
| `agent_inbox_notifications` | CRM alerts: `hot_lead`, `missed_call`, `reminder` with `priority`, `title`, `body`, `data` (includes `deep_link`), `read`, `push_sent_at`. |
| `agent_notification_preferences` | Per agent: `push_hot_lead`, `push_missed_call`, `push_reminder`, `reminder_digest_minutes` (5–120). |
| `mobile_push_tokens` | Expo device tokens (existing). |

Migrations: `20260473600000_agent_inbox_notifications.sql`, `20260473710000_agent_notification_preferences.sql` (mirrored in `propertytoolsai` + `leadsmart-mobile` Supabase folders).

**RLS:** Agents read/update their own inbox and preferences (`auth_user_id` join on `agents`).

## 2. Service layer (`apps/leadsmartai`)

| Module | Responsibility |
|--------|----------------|
| `lib/notifications/agentNotifications.ts` | Insert inbox rows, list/mark read, load/upsert preferences. |
| `lib/notifications/reminderDigest.ts` | Batch pending reminder rows → one Expo push per agent (`processReminderNotificationDigest`). |
| `lib/mobile/pushDispatch.ts` | Hot lead (instant + inbox), reminder enqueue (no immediate push), missed call, inbound SMS/email, needs-human. Respects prefs. |
| `lib/mobile/expoPushSend.ts` | Expo HTTP API (`EXPO_ACCESS_TOKEN` recommended). |

**Priority behavior**

- **Hot leads:** `priority: high` push, **immediate** (when `push_hot_lead` is true).
- **Missed calls:** `priority: medium` / default Expo priority (`push_missed_call`).
- **Reminders:** Inbox row only; push runs through **digest** cron (`push_reminder`). Rows stay `push_sent_at IS NULL` until digest sends.

## 3. Push integration (Expo)

- Device registration: `POST /api/mobile/push/register` (unchanged).
- Env toggles: `MOBILE_PUSH_ENABLED`, `MOBILE_PUSH_HOT_LEAD`, `MOBILE_PUSH_MISSED_CALL`, `MOBILE_PUSH_REMINDER`, etc. (see `pushDispatch.ts`).

Shared payload types: `@leadsmart/shared` — `MobilePushNotificationKind` includes `missed_call`, `reminder_digest`; `MobilePushNotificationData` includes `screen`, `taskId`, `leadIds`, `reminderCount`.

## 4. Mobile handling

- `lib/useLeadsmartPush.ts` — registers token; on tap routes by `kind` + `screen` + `leadId` / `taskId` to `/lead/[id]`, `/tasks`, `/notifications`.
- **Missed call / `call_log`:** Opens **lead detail** (dedicated call-history UI can replace this route later).
- **Reminder digest:** Opens `/notifications`.

## 5. Notification center UI

- Screen: `apps/leadsmart-mobile/app/notifications.tsx`.
- API: `GET /api/mobile/notifications`, `POST /api/mobile/notifications` (`notificationId` + read, or `markAllRead: true`).

## 6. Settings UI

- `apps/leadsmart-mobile/app/(tabs)/settings.tsx` — toggles for hot / missed / reminder; link to notification center.

## 7. Cron / integration

| Route | Schedule | Purpose |
|-------|----------|---------|
| `GET /api/cron/reminder-notification-digest` | `*/15 * * * *` (see `vercel.json`) | Flush reminder batch pushes. |

Authorize with `CRON_SECRET` (query `token`, header `x-cron-secret`, or `Authorization: Bearer`).

### Wiring missed calls

Call `dispatchMobileMissedCallPush({ agentId, leadId, leadName, fromNumber })` from your **voice** webhook when a missed call is attributed to a lead (e.g. Twilio). Not wired by default.

### Hot leads

Existing `notifyAgentOfHotLead` → `dispatchMobileHotLeadPush` now also inserts an **inbox row** and honors `push_hot_lead`.

### Reminders

`GET /api/cron/lead-followups` still calls `dispatchMobileReminderPush`; that function now **only enqueues** an inbox row (+ `lead_events` dedupe). Push delivery is **digest-only**.

## 8. Avoiding spam

- **Dedupe:** `lead_events` for reminders (~24h per lead) and existing inbound SMS/email windows.
- **Batching:** Low-priority reminders aggregated on a schedule; single notification title/body per agent.
- **Preferences:** Users can disable categories; inbox rows still record history where applicable, with `push_sent_at` set when push is skipped.

## 9. API summary

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/mobile/notifications?limit=` | List inbox notifications |
| POST | `/api/mobile/notifications` | `{ notificationId, read? }` or `{ markAllRead: true }` |
| GET | `/api/mobile/notification-preferences` | |
| PATCH | `/api/mobile/notification-preferences` | Partial body: `push_hot_lead`, `push_missed_call`, `push_reminder`, `reminder_digest_minutes` |

All require mobile JWT (`requireMobileAgent`).

## 10. Related

- **Explainable lead attention & priority scoring** (shared weights, reasons, `deliveryTiming`): [`docs/LEAD_ATTENTION_SCORING.md`](./LEAD_ATTENTION_SCORING.md).
