# Lead conversion prediction & auto outreach

## Modules

| File | Role |
|------|------|
| `lib/leadScoring.ts` | `predictLeadScore(userProfile)` → score 0–100, category low/medium/high, reasons |
| `lib/triggerEngine.ts` | `checkTriggers({ profile })` → `shouldOutreach` if score > 70 |
| `lib/outreach.ts` | `sendSMS`, `sendEmailToUser`, `notifyAgent`, `recordOutreachSent` (Twilio + Resend) |
| `lib/conversionOutreachClient.ts` | Browser helper `evaluateConversionOutreach()` → `POST /api/outreach/evaluate` |

## API

`POST /api/outreach/evaluate` with `{ profile, contact?, leadId?, dryRun? }`  
- Merges session user email into `contact` when missing.  
- Sends SMS (Twilio) or email (Resend) only when `OUTREACH_AUTO_ENABLED=true`.  
- Cooldown: `OUTREACH_COOLDOWN_HOURS` (default 48) per logged-in `user_id` via `outreach_sent` events.

## Env

- `OUTREACH_AUTO_ENABLED` — `true` / `1` to send messages (default off / dry-run).  
- `TWILIO_*`, `RESEND_API_KEY` — same as existing SMS/email.  
- `AGENT_NOTIFICATION_EMAIL` — `notifyAgent` when `leadId` is passed.

## Triggers (client)

- After **Smart CMA** completes (`smart-cma-builder`).  
- After **AI property comparison** insight succeeds (`PropertyComparisonClient`).

## Analytics

- `outreach_sent` on `public.events` with channels + score.  
- `outreach_metric` available via `trackOutreachMetric` for future response/conversion rollups.
