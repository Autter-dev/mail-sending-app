# API Keys

## Overview

Named API keys authenticate requests to `/api/v1/*`. Keys are stored bcrypt-hashed; the raw key is shown only once at creation. Each key has its own per-minute rate limit.

## User-facing flow

1. Visit `/settings/api-keys` and click "Create Key".
2. Name the key. The server returns the raw key one time.
3. Copy and store it. Reloading the page will not show it again.
4. Use it in API calls as `Authorization: Bearer <key>`.
5. Delete a key from the index when it is no longer needed.

## Routes & pages

- `/settings/api-keys`: index, create, delete

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/api-keys` | Session | List keys (no hashes) |
| POST | `/api/internal/api-keys` | Session | Create key, returns raw key once. Body `{ name, rateLimitPerMinute? }` |
| DELETE | `/api/internal/api-keys/[id]` | Session | Revoke |

## Database

- `api_keys`: id, name, key_hash, last_used_at, rate_limit_per_minute, created_at

## Key files

- UI: `app/(dashboard)/settings/api-keys/page.tsx`
- API: `app/api/internal/api-keys/**`
- Auth check: `lib/api-auth.ts`
- Rate limiter: `lib/rate-limit/index.ts`
- Validation: `lib/validations/api-keys.ts`

## Notes

- Raw keys are 32-character `nanoid` strings. They are unrecoverable after creation; rotate by creating a new key and deleting the old one.
- `last_used_at` is updated on every successful auth. Use this to spot dormant keys.
- The rate limit uses a token-bucket implemented as a Postgres row-level lock. See `lib/rate-limit/index.ts`.
