# Shared login: Property Tools ↔ LeadSmart AI

Both apps use **Supabase Auth** with cookie-backed sessions (`@supabase/ssr`). To sign up **once** and stay signed in on **both** sites:

## 1. Same Supabase project (required)

Use **identical** values in **both** apps’ `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; can differ in permissions but usually same project)

If these differ, users get two separate accounts.

## 2. Supabase Dashboard → URL configuration

In **Authentication → URL configuration**, add every URL users hit:

- Site URL: your primary app URL (e.g. `https://propertytools.example.com`)
- **Redirect URLs**: include both apps, e.g.  
  `https://propertytools.example.com/**`  
  `https://leadsmart.example.com/**`  
  plus `http://localhost:3000/**`, `http://localhost:3001/**` for local dev as needed.

## 3. Shared session cookies (production subdomains)

Browsers only send cookies to hosts that match the cookie **domain**. By default, auth cookies are **host-only** (`app1.com` ≠ `app2.com`).

Set this in **both** apps (same value):

```bash
# Parent domain with a leading dot — covers all subdomains
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.example.com
```

Deploy both apps under that parent, e.g.:

- `https://propertytools.example.com`
- `https://leadsmart.example.com`

Do **not** use a public suffix like `.vercel.app` as the cookie domain (it would be insecure and unreliable). Use your **own** domain.

## 4. Local development (two ports)

`http://localhost:3000` and `http://localhost:3001` are **different origins**. Cookies **cannot** be shared between them. Options:

- Log in on each app while testing, or  
- Run one app only, or  
- Use a reverse proxy so both paths share one origin (advanced).

`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` is usually **unset** locally so cookies stay host-only on `localhost`.
