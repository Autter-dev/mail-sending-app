import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, lists } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { withApiAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  return withApiAuth(req, async () => {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        subject: campaigns.subject,
        fromName: campaigns.fromName,
        fromEmail: campaigns.fromEmail,
        listId: campaigns.listId,
        status: campaigns.status,
        scheduledAt: campaigns.scheduledAt,
        sentAt: campaigns.sentAt,
        totalRecipients: campaigns.totalRecipients,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        listName: lists.name,
        sent: sql<number>`(SELECT CAST(COUNT(*) AS INT) FROM campaign_sends WHERE campaign_id = ${campaigns.id} AND status = 'sent')`,
        opens: sql<number>`(SELECT CAST(COUNT(DISTINCT campaign_send_id) AS INT) FROM campaign_events WHERE campaign_id = ${campaigns.id} AND type = 'open')`,
        clicks: sql<number>`(SELECT CAST(COUNT(DISTINCT campaign_send_id) AS INT) FROM campaign_events WHERE campaign_id = ${campaigns.id} AND type = 'click')`,
      })
      .from(campaigns)
      .leftJoin(lists, eq(campaigns.listId, lists.id))
      .orderBy(desc(campaigns.createdAt))

    return NextResponse.json({ data: rows, meta: {}, error: null })
  })
}
