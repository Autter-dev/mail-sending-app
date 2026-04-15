import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq, ilike, and, count, SQL } from 'drizzle-orm'
import { authenticateApiKey } from '@/lib/api-auth'
import { createContactSchema } from '@/lib/validations/contacts'

export async function GET(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  if (!(await authenticateApiKey(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, rawLimit), 200)
  const offset = (page - 1) * limit

  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const conditions: SQL[] = [eq(contacts.listId, params.listId)]
  if (status) conditions.push(eq(contacts.status, status))
  if (search) conditions.push(ilike(contacts.email, `%${search}%`))

  const where = and(...conditions)

  const [{ total }] = await db
    .select({ total: count() })
    .from(contacts)
    .where(where)

  const data = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      metadata: contacts.metadata,
      status: contacts.status,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(contacts.createdAt)

  return NextResponse.json({
    data,
    meta: { page, limit, total },
    error: null,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  if (!(await authenticateApiKey(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', data: null, meta: {} }, { status: 400 })
  }

  const parsed = createContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', data: null, meta: { details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  const [created] = await db
    .insert(contacts)
    .values({
      listId: params.listId,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      metadata: parsed.data.metadata ?? {},
    })
    .returning()

  return NextResponse.json({ data: created, meta: {}, error: null }, { status: 201 })
}
