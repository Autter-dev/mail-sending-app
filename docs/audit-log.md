# Audit Log

## Overview

An immutable record of admin actions: campaign sends, settings changes, contact deletes, team changes, and more. Used for compliance and debugging. Filterable by actor type, resource type, and action.

## Routes & pages

- `/settings/audit-log`: searchable log

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/audit-logs` | Session | Paginated log. Query: `actorType`, `resourceType`, `action`, `page`, `limit` |

## Recorded fields

- `actor_type`: `user`, `api_key`, or `system`
- `actor_id`: user or API key ID (null for system)
- `action`: short verb, e.g. `campaign.send`, `contact.delete`, `settings.update`
- `resource_type`: e.g. `campaign`, `contact`, `list`
- `resource_id`: ID of the affected row
- `metadata`: JSON blob with action-specific context
- `ip_address`, `user_agent`, `created_at`

## Key files

- UI: `app/(dashboard)/settings/audit-log/page.tsx`
- API: `app/api/internal/audit-logs/route.ts`
- Logger: `lib/audit/index.ts`

## Database

- `audit_logs`: indexed by `created_at` and `(resource_type, resource_id)` for fast lookup of "what happened to this campaign?"

## Notes

- Logs are append-only. There is no UI to delete or edit entries.
- Sensitive fields (passwords, API keys) are never written to the log.
- API key actions are tagged with the key's name in metadata, not the raw key.
