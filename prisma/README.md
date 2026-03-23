# Prisma support schema

This folder defines **support chat** tables (`SupportConversation`, `SupportMessage`) for use with PostgreSQL (e.g. Supabase).

The monorepo pins **Prisma 6** (`prisma` / `@prisma/client` in the root `package.json`). **Prisma 7** removed `url` from `schema.prisma`; staying on v6 keeps the standard `DATABASE_URL` setup.

## Setup

1. Copy the repo root **`.env.example`** → **`.env`** and set **`DATABASE_URL`** to your Postgres connection string (Supabase: **Settings → Database → URI**, often the **direct** host for migrations).

2. From the **repo root**:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate -- --name support_chat
   ```

   Or:

   ```bash
   npx prisma generate
   npx prisma migrate dev --name support_chat
   ```

   `migrate dev` **requires** `DATABASE_URL` in the **repo root** `.env` (Prisma does not read `apps/*/\.env.local` unless you point it there).

If you use **Supabase SQL only**, run `npx prisma migrate diff` to emit SQL, or translate the models in `schema.prisma` to a Supabase migration.

## Notes

- `publicId` is safe to expose in URLs or emails; keep internal `id` server-only.
- **Unread**: `unreadForCustomer` / `unreadForSupport` are maintained by the API (customer `PATCH …/read` clears `unreadForCustomer`).
- **Internal notes**: `SupportMessage.isInternalNote` — customer-facing routes omit these from `GET` / `POST` payloads.
- **Assignment**: use `assignedAgentId` / `assignedAgentName` (no separate agent table).
