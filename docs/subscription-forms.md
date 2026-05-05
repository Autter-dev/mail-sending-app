# Subscription Forms

## Overview

A drag-and-drop form builder that produces public hosted forms and an embeddable `<script>` tag. Submissions add contacts directly to a chosen list, optionally with double opt-in.

## User-facing flow

1. Visit `/forms` and click "New Form".
2. Pick the destination list and configure fields (email, text, checkbox, select).
3. Customize branding: logo (from asset library), primary color, background color, text color.
4. Set the success message and optional redirect URL.
5. Toggle double opt-in if the destination list does not already require it.
6. Publish. Use the hosted URL `/form/[id]` or copy the embed snippet.

## Routes & pages

- `/forms`: index
- `/forms/[id]`: builder
- `/forms/[id]/submissions`: submissions log
- `/form/[id]`: public hosted form (no auth)
- `/f/[id]`: short-URL redirect to `/form/[id]`

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/forms` | Session | List forms |
| POST | `/api/internal/forms` | Session | Create form |
| GET | `/api/internal/forms/[id]` | Session | Get form |
| PATCH | `/api/internal/forms/[id]` | Session | Update fields, branding, double opt-in, confirmation template |
| DELETE | `/api/internal/forms/[id]` | Session | Delete form |
| GET | `/api/internal/forms/[id]/submissions` | Session | Paginated submissions |
| GET | `/api/public/forms/[id]/schema` | Public | Form schema for client rendering |
| POST | `/api/public/forms/[id]/submit` | Public | Submit form. Returns outcome and redirect target. |
| GET | `/api/public/forms/[id]/embed.js` | Public | Embeddable JS snippet |

## Key files

- UI: `app/(dashboard)/forms/**`, `app/form/[id]/page.tsx`
- API: `app/api/internal/forms/**`, `app/api/public/forms/**`
- Logic: `lib/forms/embed-template.ts`

## Submission outcomes

- `created`: new contact added with `active` status
- `pending`: new contact added with `pending` status, confirmation email sent
- `updated`: existing contact, metadata merged
- `duplicate`: already exists, no email sent
- `suppressed`: email is on the global suppression list, silently dropped

## Field types

- `email`: required, validated
- `text`: free text
- `checkbox`: boolean, can be required (terms acceptance)
- `select`: dropdown with author-defined options

## Embedding

The embed script injects a styled iframe pointing at `/form/[id]`. Branding values are applied at render time so changes take effect immediately without re-embedding.

## Notes

- A form's double opt-in toggle is independent from the list's `requireDoubleOptIn` flag. Either can trigger pending status.
- The confirmation email body uses the same block editor as campaigns. See [double-opt-in.md](double-opt-in.md).
