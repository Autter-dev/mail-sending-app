# Analytics

## Overview

Per-campaign engagement and delivery stats. Covers sent, bounced, failed, unique opens, unique clicks, top clicked links, and an hourly timeline.

## Routes & pages

- `/campaigns/[id]/analytics`: dashboard

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/campaigns/[id]/analytics` | Session | All stats for one campaign |
| GET | `/api/v1/campaigns/[id]/stats` | Bearer | Same payload, public API |

## Response shape

```ts
{
  sent: number,         // campaign_sends with status = sent
  bounced: number,      // status = bounced
  failed: number,       // status = failed
  opens: number,        // distinct campaign_send_ids with type = open
  clicks: number,       // distinct campaign_send_ids with type = click
  topLinks: { url: string, count: number }[],   // top 10
  timeline: { hour: string, opens: number, clicks: number }[]  // last 7 days
}
```

## Key files

- UI: `app/(dashboard)/campaigns/[id]/analytics/page.tsx`
- API: `app/api/internal/campaigns/[id]/analytics/route.ts`, `app/api/v1/campaigns/[id]/stats/route.ts`

## Charts

- Summary cards: Sent, Open Rate, Click Rate, Bounced
- Recharts `LineChart`: opens and clicks per hour over the last 7 days
- Top clicked links table

## Notes

- Open and click rates use unique counts: `unique_opens / sent` and `unique_clicks / sent`.
- Stats refresh on page load. There is no live polling; reload to see new data.
