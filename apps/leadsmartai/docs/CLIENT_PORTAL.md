# Buyer / Seller Client Portal

## URL

Mobile-first web app: **`/client/dashboard`** (tabs in bottom nav).

Requires **Supabase login** with an email that matches a row in **`leads.email`** (case-insensitive).

## Database migration

Apply `supabase/migrations/20260330_client_portal.sql`:

- `client_portal_messages` — client ↔ agent chat
- `client_saved_homes` — saved listings per auth user
- `client_portal_documents` — optional agent-published doc links per lead

## APIs (`/api/client/*`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/client/me` | Session + linked leads |
| GET | `/api/client/dashboard?leadId=` | Deal card, pipeline, next steps, recommendations |
| GET/POST | `/api/client/saved` | Saved homes |
| GET | `/api/client/tracker?leadId=` | Pipeline only |
| GET | `/api/client/documents?leadId=` | Docs + home value report link if `report_id` set |
| GET/POST | `/api/client/chat?leadId=` | Messages; client POST body `{ leadId, body }` |
| POST | `/api/client/ai` | AI assistant `{ question, leadId? }` |

## Agent replies

`POST /api/dashboard/leads/[id]/client-chat` with JSON `{ "body": "..." }` (authenticated agent, lead must belong to agent).

## Realtime

Chat uses **4s polling** while the tab is visible. Enable Supabase Realtime on `client_portal_messages` later for instant delivery.

## AI

Uses `OPENAI_API_KEY` for `/api/client/ai` (see `lib/clientPortalAi.ts`).

## Verify migration (CLI)

After applying `20260330_client_portal.sql`, from repo root:

```bash
npm run smoke:client-portal -w leadsmartai
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/leadsmartai/.env.local`. Confirms `client_portal_messages`, `client_saved_homes`, and `client_portal_documents` are readable.
