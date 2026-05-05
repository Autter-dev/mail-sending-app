# Email Providers

## Overview

Pluggable adapters for sending mail. Two are built in: Resend and AWS SES. Each provider stores its credentials AES-256-GCM encrypted and exposes a `validate()` method for connection checks.

## User-facing flow

1. Visit `/settings/providers`.
2. Click "Add Provider" and pick a type.
3. Fill the type-specific fields:
   - Resend: API key
   - SES: Access Key ID, Secret Access Key, Region
4. Click "Validate Connection" to confirm credentials work.
5. Save. Optionally set as default for new campaigns.
6. Set the per-second rate limit per provider.

## Routes & pages

- `/settings/providers`: index and add dialog

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/providers` | Session | List providers (decrypted, sensitive fields stripped) |
| POST | `/api/internal/providers` | Session | Create. Body validates and encrypts config. |
| PATCH | `/api/internal/providers/[id]` | Session | Update isDefault and other fields |
| DELETE | `/api/internal/providers/[id]` | Session | Delete |
| POST | `/api/internal/providers/[id]/validate` | Session | Run `adapter.validate()`, returns `{ valid }` |

## Key files

- UI: `app/(dashboard)/settings/providers/page.tsx`
- API: `app/api/internal/providers/**`
- Adapters: `lib/providers/resend.ts`, `lib/providers/ses.ts`
- Factory: `lib/providers/factory.ts`
- Encryption: `lib/encryption/index.ts`

## Database

- `email_providers`: id, name, type, config_encrypted, is_default, rate_limit_per_second, created_at

## Provider config shapes

```ts
// Resend
{ apiKey: string }

// SES
{ apiKey: "ACCESS_KEY_ID:SECRET_KEY", region: string }
```

## Notes

- Only one provider can be `isDefault = true`. Setting a new default unsets the previous one.
- `rateLimitPerSecond` is enforced by the worker via pg-boss `startAfter` staggering. See [campaigns.md](campaigns.md).
- `ENCRYPTION_KEY` must be a 64-char hex string (32 bytes). Rotating it invalidates all stored configs.
- Adding new provider types requires implementing `EmailProviderAdapter` in `lib/providers/types.ts` and adding it to the factory.
