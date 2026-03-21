# PropertyTools AI — API reference

All endpoints require an authenticated Supabase user.

- **App Router (recommended):** session cookie or `Authorization: Bearer <access_token>`
- **Pages Router (`/pages/api/ai/*`):** `Authorization: Bearer <access_token>` required

Base URL: `https://<your-domain>`

---

## Rate limits (UTC day)

| Plan    | Limit   |
|---------|---------|
| free    | 10/day  |
| pro     | 100/day |
| premium | unlimited |
| elite   | unlimited (treated as premium) |

Identical prompt responses may be served from cache; cache hits are logged but **do not** count toward the daily quota.

---

## POST `/api/ai/sms`

**Body (JSON)**

```json
{
  "personalization": { "city": "Los Angeles", "language": "English" },
  "lead": {
    "name": "Jordan",
    "propertyAddress": "123 Main St, Austin, TX",
    "city": "Austin",
    "estimatedValue": 825000,
    "activitySummary": "Ran CMA twice, opened seller email"
  }
}
```

**Response**

```json
{
  "ok": true,
  "text": "...",
  "cached": false,
  "tokens_used": 420
}
```

---

## POST `/api/ai/email`

Same `lead` + `personalization` shape as SMS; output is longer-form email (subject + body).

---

## POST `/api/ai/report`

```json
{
  "personalization": { "city": "Los Angeles", "language": "中文" },
  "property": {
    "address": "456 Oak Ave",
    "city": "Pasadena",
    "beds": 3,
    "baths": 2,
    "sqft": 1850,
    "estimatedValue": 1200000,
    "marketNotes": "Low inventory, multiple offers common."
  }
}
```

---

## POST `/api/ai/explain`

`mode` is required.

### Lead score explanation

```json
{
  "mode": "lead",
  "personalization": { "city": "Los Angeles" },
  "lead": {
    "name": "Alex",
    "score": 72,
    "intent": "high",
    "timeline": "0-3 months",
    "activitySummary": "Visited sell page, 2 CMA runs"
  }
}
```

### CMA explanation

```json
{
  "mode": "cma",
  "cma": {
    "subjectAddress": "789 Pine Rd",
    "estimatedValue": 650000,
    "low": 600000,
    "high": 700000,
    "compCount": 8,
    "avgPricePerSqft": 312,
    "summary": "Paste your CMA summary text from the tool here."
  }
}
```

### Notification copy

```json
{
  "mode": "notification",
  "notification": {
    "title": "Hot lead",
    "bodyHint": "Lead replied to SMS about listing timeline",
    "audience": "agent"
  }
}
```

---

## cURL (App Router, cookie session omitted — use Bearer)

```bash
curl -s -X POST "https://app.example.com/api/ai/sms" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lead":{"name":"Sam"},"personalization":{"city":"LA"}}'
```

---

## Database

Run migration:

`supabase/migrations/20260327_leadsmart_ai_layer.sql`

Tables: `ai_cache`, `ai_usage`
