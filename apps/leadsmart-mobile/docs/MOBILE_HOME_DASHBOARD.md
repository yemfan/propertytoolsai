# Mobile Home dashboard & daily agenda

The **Home** tab is the agent’s daily command center: stats, priority alerts, quick actions, and a merged **daily agenda** (tasks, appointments, follow-ups).

## API

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/mobile/dashboard` | `MobileDashboardResponse`: `stats`, `priorityAlerts`, `quickActions` |
| `GET` | `/api/mobile/daily-agenda` | `MobileDailyAgendaResponseDto`: `agendaDate` (`YYYY-MM-DD` UTC), `items` |
| `GET` | `/api/mobile/agenda` | Same handler as `daily-agenda` (backward compatible) |

Optional query on agenda routes: `date=YYYY-MM-DD` (UTC day).

## Shared types (`@leadsmart/shared`)

- `MobileDashboardStats`, `MobileDashboardPriorityAlert`, `MobileDashboardResponse`
- `DailyAgendaItem`, `MobileDailyAgendaResponseDto`

## Mobile client

- `fetchMobileDashboard()` — dashboard payload.
- `fetchMobileDailyAgenda({ date? })` — canonical client for the daily agenda (`MOBILE_API_PATHS.dailyAgenda`).
- `fetchMobileAgenda` — deprecated alias of `fetchMobileDailyAgenda`.

## UI components

| Component | Role |
|-----------|------|
| `components/home/DashboardStatCard.tsx` | Single stat; tappable → inbox / tasks / calendar / hot leads |
| `components/home/PriorityAlertCard.tsx` | Action-oriented alert row (Review / Resolve / Handle / Reply) |
| `components/home/QuickActionRow.tsx` | Horizontal chips from server `quickActions` |
| `components/home/DailyAgendaList.tsx` | Agenda rows; empty state when no items |
| `components/home/v2/HomeFeatureSections.tsx` | **v1.6**: Four-section tile grid (Work/Engage/Analyze/Manage) that mirrors the web `PremiumSidebarV2`. Replaces the legacy flat chip row. |
| `components/home/v2/HomeFeatureTile.tsx` | Single feature tile — icon-on-tinted-square + label + optional HOT/VIP/NEW badge. |
| `components/home/v2/HomeFeatureGrid.tsx` | 3-column flex grid for tiles. |
| `components/home/v2/HomeSectionHeader.tsx` | Supercategory label with left accent pill. |

Screen: `app/(tabs)/home.tsx`.

## v1.6 home redesign

See [HOME_REDESIGN_PLAN.md](./HOME_REDESIGN_PLAN.md) for the full
web-→-mobile feature mapping and the section accent palette. Section
order: hero block → 4 supercategory tile grids → Daily Agenda →
Priority Alerts → Weekly Digest → Lead Queue → Quick Actions.

The legacy chip row (Hot Leads / Unread / Tasks / Appointments / CMA
/ Postcards / Quick Post / Sphere / Scheduled / Recurring / Posts /
Showings / Coaching / Alerts) has been removed — those features are
now either in the tile grid (deeper features) or one tap away via the
bottom tab bar (Inbox / Leads / Calendar). The Scheduled-posts count
badge that hung off the legacy chip is a follow-up TODO; tile-level
counts will land in v1.6.1.

## Navigation & deep links

| Source | Target |
|--------|--------|
| Stat: hot leads | `/(tabs)/leads?filter=hot` |
| Stat: unread | `/(tabs)/inbox` |
| Stat: tasks / appointments | `/(tabs)/tasks`, `/(tabs)/calendar` |
| Quick action: Add task | `/(tabs)/tasks` |
| Quick action: Appointment | `/(tabs)/calendar?newAppt=1` → opens appointment composer |
| Quick action: Booking link | `/(tabs)/leads?booking=1` → hint banner on leads list |
| Quick action: Hot leads | `/(tabs)/leads?filter=hot` |
| Alert / agenda row with `leadId` | `/lead/[id]` |

**Leads** reads `filter` (`hot` \| `inactive`) and `booking=1` via `useLocalSearchParams`. Hot/inactive lists skip the demo lead fallback.

**Calendar** reads `newAppt=1` on focus and opens `AppointmentComposerModal`, then clears the param.

## States

- **Loading:** full-screen `ScreenLoading` until the first combined fetch completes.
- **Error:** dashboard hard-fail on first load → full-screen `ErrorBanner` + retry. Partial failures (e.g. agenda only) show an inline banner; dashboard data from a previous successful refresh is preserved when a later refresh fails.
- **Empty:** no priority alerts → short muted copy; no agenda rows → `EmptyState` inside `DailyAgendaList`.

## Backend quick actions

Default `quickActions` from `lib/mobile/mobileDashboard.ts`:

- `add_task`, `create_appointment`, `send_booking_link`, `open_hot_leads`

Older mobile builds that still receive `inbox` / `leads` / `tasks` / `calendar` keys are handled in `home.tsx` `handleQuickAction`.
