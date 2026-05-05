# Open and Click Tracking

## Overview

Every sent email gets a 1x1 transparent GIF at the bottom and all `href` links rewritten through a redirect endpoint. Both record events keyed to the originating `campaign_send` row.

## Routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/t/[sendId]` | Public | Returns a 1x1 GIF and records an `open` event |
| GET | `/r/[id]` | Public | Decodes a base64url payload `{ sendId, url }`, records a `click`, redirects |

## How it works

- `lib/renderer/index.ts` runs `wrapLinks()` on the HTML to replace `href="..."` with `href="${APP_URL}/r/${encoded}"` where `encoded = base64url(JSON.stringify({ sendId, url }))`.
- Unsubscribe and tracking-pixel links are excluded from rewriting.
- The pixel `<img src="${APP_URL}/t/${sendId}" ...>` is appended as the last row of the email body.

## Captured fields per event

- `campaign_send_id`, `campaign_id`, `type` (`open` or `click`), `link_url` for clicks, `ip_address`, `user_agent`, `created_at`

## Key files

- Open: `app/t/[sendId]/route.ts`
- Click: `app/r/[id]/route.ts`
- Renderer: `lib/renderer/index.ts`
- Tracking helpers: `lib/tracking/index.ts`

## Notes

- Set `disableTracking = true` on a campaign to skip link wrapping and pixel injection. Useful for transactional-style sends or privacy-conscious lists.
- Open tracking is best-effort. Many email clients block remote images by default, so opens are an undercount.
- Click events are deduplicated for unique-click stats by `campaign_send_id`. Raw events are not deduplicated.
- The `/r` endpoint uses a 302 redirect, so the original URL never appears in the click event header chain.
