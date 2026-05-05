# Global Suppression List

## Overview

A project-wide do-not-send list. Any email on it is skipped at campaign send time, regardless of which list it appears in. Auto-populated by bounce and complaint webhooks; manually manageable via UI and API.

## User-facing flow

1. Visit `/settings/suppressions` to see all suppressed addresses.
2. Add an address manually with a reason.
3. Or click "Upload" to bulk-import from CSV (same upload-then-confirm pattern as contact import).
4. Remove an address to stop suppressing it (use with caution; bounces and complaints should usually stay).

## Routes & pages

- `/settings/suppressions`: index
- `/settings/suppressions/upload`: CSV import flow

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/suppressions` | Session | Paginated list with filter by reason |
| POST | `/api/internal/suppressions` | Session | Add one, body `{ email, reason }` |
| DELETE | `/api/internal/suppressions/[id]` | Session | Remove one |
| POST | `/api/internal/suppressions/upload` | Session | Stage CSV, returns `{ s3Key, preview }` |
| POST | `/api/internal/suppressions/upload/confirm` | Session | Confirm import, returns counts |
| GET | `/api/v1/suppressions` | Bearer | Paginated list |
| POST | `/api/v1/suppressions` | Bearer | Add one |
| DELETE | `/api/v1/suppressions/[id]` | Bearer | Remove one |
| POST | `/api/v1/suppressions/bulk` | Bearer | Bulk add (max 1000) |

## Key files

- UI: `app/(dashboard)/settings/suppressions/**`
- API: `app/api/internal/suppressions/**`, `app/api/v1/suppressions/**`
- Logic: `lib/suppressions/index.ts`

## Reasons

- `bounce`: hard bounce reported by provider
- `complaint`: spam complaint reported by provider
- `unsubscribe`: user clicked unsubscribe (also sets contact status)
- `manual`: added by an admin
- `imported`: added via CSV import

## How send-time gating works

`app/api/internal/campaigns/[id]/send/route.ts` builds the recipient list with a `NOT EXISTS` subquery against the `suppressions` table. Suppressed contacts never get a `campaign_sends` row. Bounce and complaint webhooks insert into `suppressions` and update the matching contact's status.

## Notes

- The list is global, not per-list. Once suppressed, an address is suppressed for every list and every campaign.
- Removing a suppression does not re-activate the contact in any list. The contact must be reactivated separately if needed.
