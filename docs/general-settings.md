# General Settings

## Overview

Application-wide settings stored in a singleton `app_settings` row. Currently covers the double opt-in confirmation sender and the customizable unsubscribe page copy.

## Routes & pages

- `/settings/general`: editor

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/settings` | Session | Read settings |
| PATCH | `/api/internal/settings` | Session | Update settings |

## Settings

- `confirmationFromEmail`: from address for double opt-in confirmation emails. Falls back to env `CONFIRMATION_FROM_EMAIL`.
- `confirmationFromName`: from name for confirmation emails. Falls back to env `APP_NAME`.
- `unsubscribePage`: object with copy for four states (confirm, confirmed, alreadyUnsubscribed, invalid). Each has title, body, and buttonLabel.

## Key files

- UI: `app/(dashboard)/settings/general/page.tsx`
- API: `app/api/internal/settings/route.ts`
- Logic: `lib/settings/index.ts`, `lib/settings/unsubscribe-page.ts`
- Editor component: `components/settings/UnsubscribePageEditor.tsx`

## Notes

- Settings are cached server-side per request. Changes take effect on the next request.
- Leaving a confirmation field blank uses the env-var fallback.
