import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq, ilike, and, count, SQL } from 'drizzle-orm'
import { createContactSchema } from '@/lib/validations/contacts'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = req.nextUrl

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, rawLimit), 200)
  const offset = (page - 1) * limit

  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const conditions: SQL[] = [eq(contacts.listId, params.id)]

  if (status) {
    conditions.push(eq(contacts.status, status))
  }

  if (search) {
    conditions.push(ilike(contacts.email, `%${search}%`))
  }

  const where = and(...conditions)

  const [{ total }] = await db
    .select({ total: count() })
    .from(contacts)
    .where(where)

  const data = await db
    .select()
    .from(contacts)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(contacts.createdAt)

  return NextResponse.json({
    data,
    meta: { page, limit, total },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createContactSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(', ')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const [created] = await db
      .insert(contacts)
      .values({
        listId: params.id,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'A contact with this email already exists in this list' }, { status: 409 })
    }
    throw e
  }
}
