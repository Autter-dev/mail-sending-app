# Dashboard

## Overview

The home page after login. Shows aggregate stats and links to recent campaigns. The sidebar layout wraps every page under `app/(dashboard)`.

## User-facing flow

1. User logs in and lands on `/dashboard`.
2. Sees summary cards: Total Lists, Total Contacts, Total Campaigns Sent, Average Open Rate.
3. Recent campaigns table shows the last 5 with status and stats.
4. Quick action buttons: Create List, New Campaign.

## Routes & pages

- `/`: redirects to `/dashboard`
- `/dashboard`: home page
- All `/lists`, `/campaigns`, `/templates`, `/forms`, `/assets`, `/settings/*` use the same shell

## Sidebar sections

- Dashboard
- Lists
- Campaigns
- Templates
- Forms
- Assets
- Settings: General, Providers, Suppressions, API Keys, Team, Audit Log

## Key files

- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `components/dashboard/sidebar.tsx`
- `app/page.tsx`: root redirect

## Notes

- Sidebar footer shows the signed-in user email and a sign-out button.
