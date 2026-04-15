import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const campaignId = params.id

  const [sendStatsResult, eventStatsResult, topLinksResult, timelineResult] =
    await Promise.all([
      db
        .select({
          sent: sql<number>`cast(count(case when status = 'sent' then 1 end) as int)`,
          bounced: sql<number>`cast(count(case when status = 'bounced' then 1 end) as int)`,
          failed: sql<number>`cast(count(case when status = 'failed' then 1 end) as int)`,
        })
        .from(campaignSends)
        .where(eq(campaignSends.campaignId, campaignId)),

      db
        .select({
          opens: sql<number>`cast(count(distinct case when type = 'open' then campaign_send_id end) as int)`,
          clicks: sql<number>`cast(count(distinct case when type = 'click' then campaign_send_id end) as int)`,
        })
        .from(campaignEvents)
        .where(eq(campaignEvents.campaignId, campaignId)),

      db
        .select({
          url: campaignEvents.linkUrl,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(campaignEvents)
        .where(
          and(
            eq(campaignEvents.campaignId, campaignId),
            eq(campaignEvents.type, 'click')
          )
        )
        .groupBy(campaignEvents.linkUrl)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      db
        .select({
          hour: sql<string>`date_trunc('hour', ${campaignEvents.createdAt})::text`,
          opens: sql<number>`cast(count(case when type = 'open' then 1 end) as int)`,
          clicks: sql<number>`cast(count(case when type = 'click' then 1 end) as int)`,
        })
        .from(campaignEvents)
        .where(
          and(
            eq(campaignEvents.campaignId, campaignId),
            sql`${campaignEvents.createdAt} > now() - interval '7 days'`
          )
        )
        .groupBy(sql`date_trunc('hour', ${campaignEvents.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${campaignEvents.createdAt})`),
    ])

  const sendStats = sendStatsResult[0] ?? { sent: 0, bounced: 0, failed: 0 }
  const eventStats = eventStatsResult[0] ?? { opens: 0, clicks: 0 }

  const topLinks = topLinksResult.map((row) => ({
    url: row.url ?? '',
    count: row.count,
  }))

  const timeline = timelineResult.map((row) => ({
    hour: row.hour,
    opens: row.opens,
    clicks: row.clicks,
  }))

  return NextResponse.json({
    sent: sendStats.sent,
    bounced: sendStats.bounced,
    failed: sendStats.failed,
    opens: eventStats.opens,
    clicks: eventStats.clicks,
    topLinks,
    timeline,
  })
}
