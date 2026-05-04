# Mailpost: Product Specification

## Overview

Mailpost is an open source, self-hostable broadcast email tool. It lets a small team manage contact lists, design block-based emails, send broadcasts through their own Resend or Amazon SES account, and track engagement, all without depending on a hosted SaaS provider. The full stack runs from a single Postgres database and an S3-compatible object store, with no Redis or external queue.

## Target users

Operators and small product or marketing teams who want to own their email infrastructure. Typical fit:

- Founders sending product updates to early users
- Indie hackers running newsletters without paying per-contact fees
- Product teams that need to gate sending behind their own auth, audit, and compliance rules
- Teams replacing a hosted ESP with something they can self-host on Railway, Render, Fly.io, or a private VM

## Core capabilities

### Contact list management
- Multiple lists, each with its own contacts and metadata schema
- CSV and XLSX upload with column mapping (email, first name, last name, arbitrary metadata keys)
- Per-list contact statuses: active, bounced, unsubscribed
- Optional double opt-in per list, with a confirmation token issued at signup
- Search and pagination by status

### Suppressions
- Global suppression list, applied across every campaign
- Auto-populated from bounce and complaint webhooks (Resend, SES via SNS)
- Send-time gating: a suppressed address is skipped before the provider call
- CSV import for migrating suppressions from a previous tool
- Public API for reading and writing entries

### Email providers
- Pluggable adapter interface with two built-in adapters: Resend, SES
- Per-provider credentials encrypted at rest with AES-256-GCM
- Connection validation before save
- One default provider, with per-provider rate limit config

### Campaigns
- Block-based editor: heading, text, image, button, divider, spacer
- Live mobile and desktop preview via iframe
- Merge tags backed by Handlebars: `{{first_name}}`, `{{email}}`, plus any metadata key on the list
- Per-recipient render with juice-inlined styles
- Test send to an arbitrary address
- Scheduled sends with cancel before launch
- In-flight cancel: worker checks `cancel_requested` before each individual send

### Templates library
- Save any campaign as a reusable template
- Thumbnails for fast browsing
- Apply a template to a new campaign in one click

### Asset library
- Centralised image and file uploads stored on S3 or MinIO
- Reused across campaigns and templates from a single picker
- Tracks kind, dimensions, and content type

### Embeddable signup forms
- Hosted form definitions with custom fields and a target list
- Optional double opt-in with a custom confirmation email
- Embed snippet for inserting the form into a marketing site

### Tracking
- Open tracking via 1x1 transparent pixel keyed by send id
- Click tracking by rewriting outbound `href` to a redirector that records and forwards
- Bounces and complaints captured from provider webhooks
- All events written to `campaign_events`

### Analytics
- Per-campaign summary: sent, bounced, failed, open rate, click rate
- Top clicked links table
- Hour-by-hour timeline of opens and clicks (last 7 days)

### Unsubscribe
- One-click per-contact unsubscribe via signed token
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers per RFC 8058
- Public-facing unsubscribe page outside the dashboard auth

### Audit log
- Append-only event trail for sensitive admin actions (provider changes, key rotations, exports, deletions)
- Filtering, search, and CSV export from the dashboard
- Retention policy with date-based cutoffs

### Public REST API
- API keys hashed with bcrypt, shown to the user once at creation
- Per-key rate limit (token bucket on `rate_limit_per_minute`, `rate_limit_tokens`, `rate_limit_updated_at`)
- Endpoints for lists, contacts, bulk contact upsert, campaigns, campaign stats, suppressions
- Consistent `{ data, meta, error }` response envelope

## Data model

The schema lives in `lib/db/schema.ts`. Twelve tables back the product:

| Table | Purpose |
|---|---|
| `lists` | Contact lists, per-list double opt-in flag |
| `contacts` | List members, status, unsubscribe token, optional confirmation token |
| `email_providers` | Resend or SES credentials, encrypted, with rate limit |
| `campaigns` | Broadcast definitions, template JSON, schedule, status |
| `campaign_sends` | One row per recipient per campaign, with provider message id |
| `campaign_events` | Opens, clicks, bounces, complaints, unsubscribes |
| `templates` | Saved reusable campaign templates with thumbnails |
| `assets` | Centralised image and file references for the library |
| `forms` | Embeddable signup form definitions |
| `suppressions` | Global suppression list, source-tagged |
| `audit_logs` | Append-only admin event trail |
| `api_keys` | Hashed API tokens with per-key rate limiting |

## Architecture

- Next.js 14 (App Router, TypeScript, standalone output) for the dashboard, internal API, public API, tracking endpoints, and unsubscribe page
- Drizzle ORM against a single Postgres database
- pg-boss as the queue, also on Postgres, so no Redis dependency
- A standalone `worker.ts` process consumes send jobs at a configurable concurrency
- S3-compatible object storage for assets and CSV uploads, MinIO locally
- Pluggable provider adapters under `lib/providers/`, factory in `lib/providers/factory.ts`
- AES-256-GCM symmetric encryption for provider credentials, key from `ENCRYPTION_KEY`
- NextAuth.js v4 credentials auth for the dashboard, bcrypt-hashed API keys for the public API

## Out of scope

- Multi-tenant accounts or per-user permissions. Mailpost is single-tenant by design.
- Deliverability monitoring beyond what bounce and complaint webhooks expose.
- Transactional or per-user triggered email. Mailpost is a broadcast tool.
- Shared inbox or reply handling. Replies go to whatever inbox the from address resolves to.
- A hosted SaaS offering. Self-host only.

## Roadmap

See `ROADMAP.md` for in-flight and planned work.
