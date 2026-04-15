import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { authenticateApiKey } from '@/lib/api-auth'
import { bulkContactsSchema } from '@/lib/validations/contacts'

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

  const parsed = bulkContactsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', data: null, meta: { details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  let inserted = 0
  let updated = 0
  let skipped = 0

  const batchSize = 500
  const items = parsed.data.contacts

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const values = batch.map((c) => ({
      listId: params.listId,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      metadata: c.metadata ?? {},
    }))

    try {
      const result = await db
        .insert(contacts)
        .values(values)
        .onConflictDoUpdate({
          target: [contacts.listId, contacts.email],
          set: {
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            metadata: sql`excluded.metadata`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: contacts.id })

      // Approximate: all returned rows are either inserted or updated
      inserted += result.length
    } catch {
      skipped += batch.length
    }
  }

  return NextResponse.json({
    data: { inserted, updated, skipped },
    meta: {},
    error: null,
  })
}
