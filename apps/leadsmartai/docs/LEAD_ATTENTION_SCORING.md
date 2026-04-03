# Lead attention scoring & notification priority

Explainable, additive heuristics (no ML black box) shared across **mobile dashboard**, **web agent dashboard**, **push/inbox**, and future automation.

## 1. Types (`@leadsmart/shared`)

| Export | Purpose |
|--------|---------|
| `LeadAttentionSignals` | All optional boolean/number inputs (hot lead, prediction score, missed call, unread, overdue task, needs_human, urgent callback, showing soon, seller timeline, response risk). |
| `LeadAttentionScoreResult` | `score` (0–100 capped), `priority` (`high` \| `medium` \| `low`), `reasons[]`, `contributions[]` (key + points + reason), `deliveryTiming`. |
| `NotificationDeliveryTiming` | `immediate` \| `normal` \| `batched` |
| `NotificationPriority` | Shared tier for inbox + UI badges. |

Legacy: `NotificationContextScoreInput` / `scoreNotificationContext` delegate to the same engine.

## 2. Scoring module

- **Implementation:** `packages/shared/src/utils/lead-attention-score.ts`
- **Weights:** exported as `LEAD_ATTENTION_WEIGHTS` (transparent defaults).
- **Thresholds:** `DEFAULT_LEAD_ATTENTION_THRESHOLDS` — `highMin: 72`, `mediumMin: 42` (tune in one place).
- **Extending:** Add a field to `LeadAttentionSignals`, add a branch in `scoreLeadAttention` with a named `key` and human `reason`.

## 3. Timing / batching rules

- **File:** `packages/shared/src/utils/notification-delivery-rules.ts`
- **Mapping:** `priorityToDeliveryTiming` — high → `immediate`, medium → `normal`, low → `batched`.
- **Product rule:** Aligns with LeadSmart notification behavior: hot/urgent paths send immediately; reminders stay batched (see `NOTIFICATION_SYSTEM.md`).

## 4. Service layer (LeadSmart AI app)

| File | Role |
|------|------|
| `lib/lead-priority/leadAttentionSignals.ts` | Map `leads` rows + dashboard alert types → `LeadAttentionSignals`. |
| `lib/lead-priority/attentionPriorityService.ts` | `evaluateLeadAttention`, `deliveryTimingForPriority` — call from APIs or jobs. |
| `lib/mobile/mobileDashboard.ts` | Fetches `rating`, `prediction_score`, `prediction_label` for alert leads; scores each alert; **sorts by `attentionScore` desc**; attaches `attentionScore`, `attentionPriority`, `attentionReasons`, `deliveryTiming`. |

## 5. Integration

| Surface | Behavior |
|---------|----------|
| **Mobile home** | `MobileDashboardPriorityAlert` includes optional attention fields; `PriorityAlertCard` shows high-priority badge / top reason. |
| **Web agent dashboard** | Hot lead list uses engagement as a proxy for `dealPredictionScore` where CRM deal prediction columns are absent; shows attention priority + first reason. |
| **Notifications** | Use `scoreNotificationContext` / `scoreLeadAttention` when building payloads so copy and routing match dashboard priority (see `NOTIFICATION_SYSTEM.md`). |

## 6. Operational notes

- **Deal prediction:** When `leads.prediction_score` is present, it drives `prediction_high` / `prediction_medium` / `prediction_low` contributions.
- **Web PropertyTools:** Dashboard lead select may omit `prediction_score`; engagement score is used as a single proxy — tighten when the column is available in that schema.
- **Seller / showing signals:** `showingScheduledSoon` and response-risk flags are reserved for calendar/event integrations — set server-side when wired.
