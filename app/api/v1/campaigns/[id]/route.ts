import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, lists } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { authenticateApiKey } from '@/lib/api-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await authenticateApiKey(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    .where(eq(campaigns.id, params.id))

  if (!rows[0]) {
    return NextResponse.json({ error: 'Campaign not found', data: null, meta: {} }, { status: 404 })
  }

  return NextResponse.json({ data: rows[0], meta: {}, error: null })
}
