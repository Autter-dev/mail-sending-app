# Unsubscribe

## Overview

Every sent email includes an unsubscribe link in the footer and `List-Unsubscribe` headers. The page is public, token-based, and the copy is fully customizable.

## User-facing flow

1. Recipient clicks the unsubscribe link. URL is `/unsubscribe/[token]` where the token is the contact's `unsubscribe_token`.
2. The page shows the contact's email and asks to confirm.
3. On confirm, the contact's `status` is set to `unsubscribed`, an `unsubscribe` event is logged for the most recent campaign send, and a confirmation message is shown.
4. Already-unsubscribed and invalid-token states render their own copy.

## Routes & pages

- `/unsubscribe/[token]`: public page (no auth)

## Page states (all customizable)

- `confirm`: initial confirmation prompt
- `confirmed`: success state after unsubscribing
- `alreadyUnsubscribed`: contact was already unsubscribed
- `invalid`: token did not match a contact

Each state has editable title, body, and button label. Edit at `/settings/general`.

## Headers set per send

```
List-Unsubscribe: <APP_URL/unsubscribe/[token]>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

## Key files

- Page: `app/unsubscribe/[token]/page.tsx`
- Settings: `lib/settings/unsubscribe-page.ts`, `lib/settings/unsubscribe-page-server.ts`
- Editor: `components/settings/UnsubscribePageEditor.tsx`

## Notes

- The page never reveals contact identity beyond the email associated with the token.
- The token is the contact's `unsubscribe_token` UUID, generated at insert time.
- Unsubscribing also adds the email to the global suppression list with reason `unsubscribe`.
