# Campaigns

## Overview

A campaign represents one broadcast: a list, a template, a provider, and a schedule. The full lifecycle is draft, scheduled, sending, sent, failed.

## User-facing flow

1. Visit `/campaigns` and click "New Campaign". Pick a name and list.
2. The app redirects to `/editor/[id]`. Configure subject, from fields, provider, and content.
3. Return to `/campaigns/[id]` and click "Send" or "Schedule".
4. While sending, watch the progress bar (polled every 3 seconds). Cancel if needed.
5. When complete, view stats via the analytics page.

## Routes & pages

- `/campaigns`: index with status, recipients, open and click rates
- `/campaigns/[id]`: detail and send controls
- `/campaigns/[id]/analytics`: post-send stats (see [analytics.md](analytics.md))
- `/editor/[campaignId]`: editor (see [mail-editor.md](mail-editor.md))

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/campaigns` | Session | List with stats |
| POST | `/api/internal/campaigns` | Session | Create draft, body `{ name, listId }` |
| GET | `/api/internal/campaigns/[id]` | Session | Get campaign |
| PATCH | `/api/internal/campaigns/[id]` | Session | Update fields |
| DELETE | `/api/internal/campaigns/[id]` | Session | Delete (draft only) |
| POST | `/api/internal/campaigns/[id]/send` | Session | Queue sends, body `{ scheduledAt? }` |
| POST | `/api/internal/campaigns/[id]/cancel` | Session | Set `cancelRequested = true` |
| POST | `/api/internal/campaigns/[id]/test-send` | Session | Test to one address |
| POST | `/api/internal/campaigns/[id]/save-as-template` | Session | Snapshot to templates library |
| GET | `/api/internal/campaigns/[id]/analytics` | Session | Engagement stats (see analytics.md) |

## Statuses

- `draft`: editable, not queued
- `scheduled`: queued with `startAfter` in the future
- `sending`: jobs in flight
- `sent`: finalize job ran
- `failed`: terminal failure (rare)

## Send pipeline

1. `POST /send` validates the campaign has subject, from fields, provider, and list.
2. Loads all `active` contacts in the list, minus globally suppressed addresses.
3. Inserts `campaign_sends` rows in batches of 500.
4. Enqueues one `send-email` pg-boss job per contact.
5. Stagger: each job's `startAfter` is computed from `sendRatePerMinute` to spread sends evenly.
6. The worker (`worker.ts`) processes each job: re-checks `cancelRequested`, renders the template per-contact, calls the provider adapter, updates the send row.
7. A `finalize-campaign` job runs after the estimated completion time and flips the campaign to `sent`.

## Database

- `campaigns`: id, name, subject, from_name, from_email, list_id, provider_id, template_json, template_html, status, scheduled_at, sent_at, total_recipients, cancel_requested, send_rate_per_minute, disable_tracking, timestamps
- `campaign_sends`: id, campaign_id, contact_id, status, provider_message_id, error_message, sent_at, created_at

## Notes

- `sendRatePerMinute` is configurable per campaign (1 to 100,000). Combined with `email_providers.rate_limit_per_second` to respect provider limits.
- `disableTracking` skips link wrapping and the open pixel. See [tracking.md](tracking.md).
- Cancellation is best-effort: jobs already mid-flight finish, but no new sends start.
- Do not change `APP_URL` after sending: tracking and unsubscribe links embed it.
