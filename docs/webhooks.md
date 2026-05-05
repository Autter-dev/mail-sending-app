# Webhooks

## Overview

Inbound webhooks from email providers update delivery status and the global suppression list. Resend uses Svix-signed payloads. SES uses SNS notifications.

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/webhooks/resend` | Svix signature | Resend events |
| POST | `/api/webhooks/ses` | SNS signature + SubscriptionConfirmation | SES via SNS |

## Resend events handled

- `email.bounced`: sets matching `campaign_sends.status = bounced`, sets contact status to `bounced`, adds to global suppressions.
- `email.complained`: same as bounced but with reason `complaint` and contact status `unsubscribed`.
- All events insert a `campaign_events` row keyed by `provider_message_id`.

## SES handling

- `Type = SubscriptionConfirmation`: the route auto-fetches `SubscribeURL` to confirm.
- `Type = Notification`:
  - `notificationType = Bounce`: handle each `bouncedRecipients[].emailAddress`
  - `notificationType = Complaint`: handle each `complainedRecipients[].emailAddress`

## Key files

- `app/api/webhooks/resend/route.ts`
- `app/api/webhooks/ses/route.ts`

## Configuration

- Resend: set the webhook secret via `RESEND_WEBHOOK_SECRET`. Configure the webhook URL in the Resend dashboard.
- SES: subscribe an SNS topic to bounce and complaint notifications, then add an HTTPS subscription to `https://your-host/api/webhooks/ses`.

## Notes

- The endpoints always return `200` to acknowledge so providers do not retry on transient DB issues. Errors are logged.
- Lookups are by `provider_message_id`. If a message ID does not match any send, the event is recorded as orphaned and ignored.
