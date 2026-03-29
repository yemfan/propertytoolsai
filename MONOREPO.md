# Monorepo layout (pnpm)

| Path | Role |
|------|------|
| `apps/propertytoolsai` | Public lead-gen / Property Tools web app |
| `apps/leadsmartai` | LeadSmart CRM / AI / automation web app |
| `apps/leadsmart-mobile` | LeadSmart Expo (iOS / Android) |
| `packages/shared` | `@leadsmart/shared` — types, constants, utils |
| `packages/api-client` | `@leadsmart/api-client` — `apiFetch`, DTO re-exports |
| `packages/*` | Existing `@repo/*` internal packages |

Aliases: `@leadsmart/shared/*`, `@leadsmart/api-client/*` (see each app `tsconfig.json` + Next `transpilePackages`).

Package manager: **pnpm** (`pnpm-workspace.yaml`). Use `pnpm install` at the repo root; remove root `package-lock.json` after migrating.
