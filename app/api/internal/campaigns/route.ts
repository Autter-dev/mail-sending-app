import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, lists } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { z } from 'zod'

const createCampaignSchema = z.object({
  name: z.string().min(1),
  listId: z.string().uuid(),
})

export async function GET() {
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      listId: campaigns.listId,
      providerId: campaigns.providerId,
      status: campaigns.status,
      scheduledAt: campaigns.scheduledAt,
      sentAt: campaigns.sentAt,
      totalRecipients: campaigns.totalRecipients,
      cancelRequested: campaigns.cancelRequested,
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

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, listId } = parsed.data

  const [created] = await db
    .insert(campaigns)
    .values({ name, listId, status: 'draft' })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
