# Support chat (client + server)

| File | Role |
|------|------|
| `api.ts` | Browser `fetch` helpers for `/api/support-chat/*`. |
| `polling.ts` | `usePolling` hook for live refresh. |
| `useSupportRealtime.tsx` | Supabase Realtime **Presence** + **Broadcast** (typing / who’s viewing); no DB writes. |
| `schema.ts` | Zod schemas for Route Handlers (server). |
| `service.ts` | Supabase admin persistence (server). |

The UI-facing surface is **`api.ts`**, **`polling.ts`**, and **`useSupportRealtime.tsx`**. **`schema.ts`** / **`service.ts`** are imported only from `app/api/support-chat/*`.

**Realtime:** Uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser client). Ensure your Supabase project has **Realtime** enabled; channels are named `support_thread:<conversationPublicId>`.
