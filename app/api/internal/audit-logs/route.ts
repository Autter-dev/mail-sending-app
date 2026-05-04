import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { and, desc, eq, gte, lte, count, SQL } from 'drizzle-orm'

const DEFAULT_EXPORT_MAX_ROWS = 100_000

function parseFilters(searchParams: URLSearchParams): SQL | undefined {
  const conditions: SQL[] = []
  const actorType = searchParams.get('actorType')
  const resourceType = searchParams.get('resourceType')
  const resourceId = searchParams.get('resourceId')
  const action = searchParams.get('action')
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

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

  return conditions.length > 0 ? and(...conditions) : undefined
}

const CSV_COLUMNS = [
  'id',
  'createdAt',
  'actorType',
  'actorId',
  'actorLabel',
  'action',
  'resourceType',
  'resourceId',
  'ipAddress',
  'userAgent',
  'metadata',
] as const

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const where = parseFilters(searchParams)
  const format = searchParams.get('format')

  if (format === 'csv') {
    const exportMax = parseInt(process.env.AUDIT_LOG_EXPORT_MAX_ROWS ?? String(DEFAULT_EXPORT_MAX_ROWS), 10)
    const cap = Number.isFinite(exportMax) && exportMax > 0 ? exportMax : DEFAULT_EXPORT_MAX_ROWS

    const [{ total }] = await db.select({ total: count() }).from(auditLogs).where(where)
    if (total > cap) {
      return NextResponse.json(
        {
          error: `Export would return ${total} rows, exceeding the cap of ${cap}. Narrow the date range or filters.`,
        },
        { status: 400 },
      )
    }

    const rows = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(cap)

    const lines: string[] = [CSV_COLUMNS.join(',')]
    for (const row of rows) {
      lines.push(CSV_COLUMNS.map((col) => csvEscape((row as Record<string, unknown>)[col])).join(','))
    }
    const body = lines.join('\n') + '\n'
    const filename = `audit-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.csv`

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, rawLimit), 200)
  const offset = (page - 1) * limit

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
