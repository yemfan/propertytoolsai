# Shared login: Property Tools ↔ LeadSmart AI

Both apps use **Supabase Auth** with cookie-backed sessions (`@supabase/ssr`).

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

In **Authentication → URL configuration**, add every URL users hit:

- Site URL: your primary app URL (e.g. `https://propertytools.example.com`)
- **Redirect URLs**: include both apps, e.g.  
  `https://propertytools.example.com/**`  
  `https://leadsmart.example.com/**`  
  plus `http://localhost:3000/**`, `http://localhost:3001/**` for local dev as needed.

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
