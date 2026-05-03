import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lists, contacts } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { auditFromSession, logAudit } from '@/lib/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [list] = await db
    .select()
    .from(lists)
    .where(eq(lists.id, params.id))

  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const [counts] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      active: sql<number>`cast(count(case when ${contacts.status} = 'active' then 1 end) as int)`,
      bounced: sql<number>`cast(count(case when ${contacts.status} = 'bounced' then 1 end) as int)`,
      unsubscribed: sql<number>`cast(count(case when ${contacts.status} = 'unsubscribed' then 1 end) as int)`,
    })
    .from(contacts)
    .where(eq(contacts.listId, params.id))

  return NextResponse.json({
    ...list,
    counts: counts ?? { total: 0, active: 0, bounced: 0, unsubscribed: 0 },
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [list] = await db.select().from(lists).where(eq(lists.id, params.id))
  await db.delete(lists).where(eq(lists.id, params.id))

  if (list) {
    await logAudit(
      await auditFromSession(req),
      'list.delete',
      { type: 'list', id: params.id },
      { name: list.name },
    )
  }

  return NextResponse.json({ success: true })
}
