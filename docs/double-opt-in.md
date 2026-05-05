# Double Opt-In

## Overview

When enabled on a list or a form, new contacts are added with `pending` status and emailed a confirmation link. They become `active` only after clicking the link.

## User-facing flow

1. A new contact is created (via form submission or list import) while double opt-in is enabled.
2. The contact is stored with status `pending` and a `confirmation_token` UUID.
3. A confirmation email is sent containing a link to `/confirm/[token]`.
4. The recipient clicks the link. The page sets the contact status to `active` and clears the token.

## Routes & pages

- `/confirm/[token]`: public confirmation page (no auth)

## Key files

- Page: `app/confirm/[token]/page.tsx`
- Mailer: `lib/email/sendConfirmation.ts`
- Settings: `app/api/internal/settings/route.ts`, `app/(dashboard)/settings/general/page.tsx`
- Schema: `contacts.confirmation_token`, `contacts.status = 'pending'`, `lists.require_double_opt_in`, `forms.double_opt_in`

## Configuration

- `confirmationFromEmail` and `confirmationFromName` in General Settings (see [general-settings.md](general-settings.md)).
- Falls back to env vars `CONFIRMATION_FROM_EMAIL` and `APP_NAME` when settings are blank.
- The confirmation email template body is editable per-form in the form builder.

## Notes

- A list with `requireDoubleOptIn = true` triggers confirmation regardless of how the contact was created (import, API, or form).
- A form with `doubleOptIn = true` overrides the list flag for submissions through that form.
- Once confirmed, the token is cleared and cannot be reused.
- Pending contacts are not eligible recipients for campaigns.
