# Shared login: Property Tools ↔ LeadSmart AI

Both apps use **Supabase Auth** with cookie-backed sessions (`@supabase/ssr`).

## One Supabase project, two websites — one Site URL is normal

Supabase shows a **single Site URL** in **Authentication → URL configuration**. That value is the **default** redirect for a few flows (e.g. some email links if no other URL is supplied). It does **not** mean only one app can use Auth.

What actually allows **both** Property Tools and LeadSmart to work on the **same** project:

1. **Redirect URLs** (same screen) — add **every** origin you use, not just the Site URL.

   Supabase uses glob rules: use **`**`** (path wildcard). **Do not** use `*.*` — that pattern does not reliably match `/auth/callback` (no dot in the path).

   **Production (www hosts)** — add each line under **Redirect URLs** (narrow paths, recommended):

   ```
   https://www.propertytoolsai.com/auth/**
   https://www.propertytoolsai.com/invite/**
   https://www.leadsmart-ai.com/auth/**
   https://www.leadsmart-ai.com/invite/**
   ```

   **Password reset:** both apps use the same path, **`/reset-password`** (site root). Add an **exact** URL per host (Supabase recommends exact paths in production):

   ```
   https://www.propertytoolsai.com/reset-password
   https://www.leadsmart-ai.com/reset-password
   ```

   Old LeadSmart links to `/auth/reset-password` still work — that route redirects to `/reset-password` and keeps the recovery hash.

   If you also use apex URLs without `www`, add the same paths for `https://propertytoolsai.com/...` and `https://leadsmart-ai.com/...`.

   **Broader (optional):** one row per host covers all routes on that host (use only if you accept that scope):

   ```
   https://www.propertytoolsai.com/**
   https://www.leadsmart-ai.com/**
   ```

   **Local dev:**

   ```
   http://localhost:3001/**
   http://localhost:3000/**
   ```

2. **OAuth (Google / Apple)** — the app passes an explicit `redirect_to` (our code uses the **current tab’s origin**). Supabase only requires that URL to match the **Redirect URLs** allowlist. The Site URL does not need to match the app the user started on.

3. **`NEXT_PUBLIC_SITE_URL` per deployment** — set this in **each** Vercel project to **that** app’s public origin (Property Tools vs LeadSmart). It drives metadata and **password-reset** links for that app. It is **not** the same as Supabase’s single Site URL field, and OAuth no longer prefers it over the browser origin (so a wrong copy does not send users to the other product).

**Practical choice for Site URL:** pick your primary marketing or “main” site (either product), or the one that receives the most email-based signups. As long as **Redirect URLs** lists both apps, OAuth and callbacks for both will work.

## Default: separate sessions per site

By default, each app uses its **own auth cookie name** (storage key), so **logging in on Property Tools does not log you in on LeadSmart AI** (and vice versa), even if they use the **same** Supabase project and the same parent domain.

Deploying this behavior **once** will **sign users out** until they log in again (old cookies used the shared default key).

## Optional: one login on both subdomains (SSO)

To sign up **once** and stay signed in on **both** sites on subdomains of the same parent domain:

### 1. Same Supabase project (required)

Use **identical** values in **both** apps’ `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; can differ in permissions but usually same project)

If these differ, users get two separate accounts.

### 2. Opt in to shared session cookies

Set **both** of these in **both** apps (same values):

```bash
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.example.com
NEXT_PUBLIC_SUPABASE_SHARED_AUTH=true
```

Without `NEXT_PUBLIC_SUPABASE_SHARED_AUTH=true`, the apps keep **isolated** sessions even if `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` is set.

### 3. Supabase Dashboard → URL configuration

In **Authentication → URL configuration**:

- **Site URL:** one default (either app is fine; see *One Supabase project, two websites* above).
- **Redirect URLs:** list **both** apps (required). Use `**` wildcards as in the *Redirect URLs* block above (not `*.*`). Include `/auth/**`, exact `/reset-password` on each production host, `/invite/**` if used, plus localhost for dev.

### 4. Deploy URLs

Deploy both apps under that parent, e.g.:

- `https://propertytools.example.com`
- `https://leadsmart.example.com`

Do **not** use a public suffix like `.vercel.app` as the cookie domain (it would be insecure and unreliable). Use your **own** domain.

## Local development (two ports)

`http://localhost:3000` and `http://localhost:3001` are **different origins**. Cookies **cannot** be shared between them. Options:

- Log in on each app while testing, or  
- Run one app only, or  
- Use a reverse proxy so both paths share one origin (advanced).

`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` is usually **unset** locally so cookies stay host-only on `localhost`.
