# Templates

## Overview

Reusable email templates store subject, from defaults, and block content. Apply a template to a new campaign, or save an existing campaign as a template.

## User-facing flow

1. Visit `/templates` to see all templates with thumbnails.
2. Create a template from scratch or via "Save as Template" from a campaign editor.
3. Edit a template at `/templates/[id]/edit`.
4. From a campaign or new-campaign flow, click "Use Template" to apply.
5. Send a test email straight from the template list.

## Routes & pages

- `/templates`: index
- `/templates/[id]/edit`: editor

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/templates` | Session | List templates |
| POST | `/api/internal/templates` | Session | Create template |
| GET | `/api/internal/templates/[id]` | Session | Get template |
| PATCH | `/api/internal/templates/[id]` | Session | Update |
| DELETE | `/api/internal/templates/[id]` | Session | Delete |
| POST | `/api/internal/templates/[id]/use` | Session | Apply to a campaign, body `{ campaignId }` |
| POST | `/api/internal/templates/[id]/test-send` | Session | Send a preview email |
| POST | `/api/internal/campaigns/[id]/save-as-template` | Session | Snapshot a campaign as a template |

## Key files

- UI: `app/(dashboard)/templates/**`
- API: `app/api/internal/templates/**`, `app/api/internal/campaigns/[id]/save-as-template/route.ts`

## Database

- `templates`: id, name, subject, from_name, from_email, template_json, template_html, timestamps

## Notes

- Thumbnails render the template HTML in a sandboxed iframe at preview size. Handlebars and juice are not run for thumbnails.
- "Use Template" overwrites the campaign's subject, from fields, and `templateJson`. It does not change list or provider.
