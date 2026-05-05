# GDPR Endpoints

## Overview

Per-contact hard delete and data export for compliance with right-to-erasure and right-to-access requests. Available from both the admin UI (internal API) and the public API.

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/internal/contacts/[id]/gdpr-delete` | Session | Hard delete with `?confirm=<email>` safety query |
| GET | `/api/internal/contacts/[id]/gdpr-export` | Session | JSON export of contact, sends, events |
| POST | `/api/v1/contacts/[id]/gdpr-delete` | Bearer | Same as above |
| GET | `/api/v1/contacts/[id]/gdpr-export` | Bearer | Same as above |

## Hard delete

- Requires `?confirm=<contact-email>` query string. The route 400s if it does not match the contact's stored email.
- Cascades: deletes the contact, all related `campaign_sends`, and all related `campaign_events`.
- Audit-logged with `action = contact.gdpr_delete`.

## Export

Returns JSON:

```ts
{
  contact: { ... },
  sends: [{ id, status, sent_at, campaign: { name, subject } }],
  events: [{ type, link_url, created_at }]
}
```

## Key files

- Logic: `lib/gdpr/index.ts`
- API: `app/api/internal/contacts/[id]/gdpr-*`, `app/api/v1/contacts/[id]/gdpr-*`

## Notes

- Hard delete is destructive and irreversible. Prefer unsubscribing for normal opt-outs; reserve delete for explicit erasure requests.
- The export does not include other contacts' data, even if they are on the same lists.
- Both operations are recorded in [audit-log.md](audit-log.md).
