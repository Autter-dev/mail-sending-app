import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { and, desc, eq, gte, lte, count, SQL } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, rawLimit), 200)
  const offset = (page - 1) * limit

  const actorType = searchParams.get('actorType')
  const resourceType = searchParams.get('resourceType')
  const resourceId = searchParams.get('resourceId')
  const action = searchParams.get('action')
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

  const conditions: SQL[] = []
  if (actorType) conditions.push(eq(auditLogs.actorType, actorType))
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType))
  if (resourceId) conditions.push(eq(auditLogs.resourceId, resourceId))
  if (action) conditions.push(eq(auditLogs.action, action))
  if (fromStr) {
    const from = new Date(fromStr)
    if (!Number.isNaN(from.getTime())) conditions.push(gte(auditLogs.createdAt, from))
  }
  if (toStr) {
    const to = new Date(toStr)
    if (!Number.isNaN(to.getTime())) conditions.push(lte(auditLogs.createdAt, to))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(where)

  const data = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({
    data,
    meta: { page, limit, total },
  })
}
