import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formSubmissions, forms } from '@/lib/db/schema'
import { eq, desc, sql, and } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(params.id)) {
    return NextResponse.json({ error: 'Invalid form id' }, { status: 400 })
  }

  const [form] = await db.select().from(forms).where(eq(forms.id, params.id))
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const outcome = url.searchParams.get('outcome')

  const conditions = [eq(formSubmissions.formId, params.id)]
  if (outcome) conditions.push(eq(formSubmissions.outcome, outcome))
  const where = conditions.length === 1 ? conditions[0] : and(...conditions)

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(formSubmissions)
    .where(where)

  const data = await db
    .select()
    .from(formSubmissions)
    .where(where)
    .orderBy(desc(formSubmissions.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)

  return NextResponse.json({
    data,
    meta: { page, limit, total: count },
    form: { id: form.id, name: form.name, fields: form.fields },
  })
}
