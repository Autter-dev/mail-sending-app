import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts, campaignSends, lists } from '@/lib/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import {
  normalizeEmail,
  pickWinner,
  completenessScore,
  type DedupCandidate,
} from '@/lib/dedup'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const [list] = await db.select().from(lists).where(eq(lists.id, params.id))
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.listId, params.id))

  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = normalizeEmail(row.email)
    const arr = groups.get(key) ?? []
    arr.push(row)
    groups.set(key, arr)
  }

  const dupGroups = Array.from(groups.entries()).filter(([, arr]) => arr.length > 1)

  if (dupGroups.length === 0) {
    return NextResponse.json({
      data: [],
      meta: { groupCount: 0, totalDuplicates: 0 },
    })
  }

  const allDupContactIds = dupGroups.flatMap(([, arr]) => arr.map((c) => c.id))
  const sendCountRows = allDupContactIds.length
    ? await db
        .select({
          contactId: campaignSends.contactId,
          count: sql<number>`count(*)::int`,
        })
        .from(campaignSends)
        .where(inArray(campaignSends.contactId, allDupContactIds))
        .groupBy(campaignSends.contactId)
    : []
  const sendCountByContact = new Map<string, number>()
  for (const r of sendCountRows) {
    sendCountByContact.set(r.contactId, Number(r.count))
  }

  const data = dupGroups.map(([normEmail, arr]) => {
    const candidates: DedupCandidate[] = arr
    const winner = pickWinner(candidates)
    return {
      normEmail,
      suggestedWinnerId: winner.id,
      contacts: arr
        .map((c) => ({
          id: c.id,
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          metadata: c.metadata ?? {},
          status: c.status,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
          completeness: completenessScore(c),
          campaignSendCount: sendCountByContact.get(c.id) ?? 0,
        }))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    }
  })

  const totalDuplicates = dupGroups.reduce((acc, [, arr]) => acc + arr.length - 1, 0)

  return NextResponse.json({
    data,
    meta: { groupCount: dupGroups.length, totalDuplicates },
  })
}
