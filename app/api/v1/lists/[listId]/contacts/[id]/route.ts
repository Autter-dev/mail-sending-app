import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { withApiAuth } from '@/lib/api-auth'
import { updateContactSchema } from '@/lib/validations/contacts'
import { auditFromApiKey, logAudit } from '@/lib/audit'

export async function PUT(
  req: NextRequest,
  { params }: { params: { listId: string; id: string } }
) {
  return withApiAuth(req, async (auth) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', data: null, meta: {} }, { status: 400 })
    }

    const parsed = updateContactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', data: null, meta: { details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email
    if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName
    if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName
    if (parsed.data.metadata !== undefined) updateData.metadata = parsed.data.metadata
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status

    const [updated] = await db
      .update(contacts)
      .set(updateData)
      .where(and(eq(contacts.id, params.id), eq(contacts.listId, params.listId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Contact not found', data: null, meta: {} }, { status: 404 })
    }

    await logAudit(
      auditFromApiKey(req, auth),
      'contact.update',
      { type: 'contact', id: updated.id },
      { listId: params.listId, fields: Object.keys(updateData).filter((k) => k !== 'updatedAt') },
    )

    return NextResponse.json({ data: updated, meta: {}, error: null })
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { listId: string; id: string } }
) {
  return withApiAuth(req, async (auth) => {
    const [deleted] = await db
      .delete(contacts)
      .where(and(eq(contacts.id, params.id), eq(contacts.listId, params.listId)))
      .returning({ id: contacts.id, email: contacts.email })

    if (!deleted) {
      return NextResponse.json({ error: 'Contact not found', data: null, meta: {} }, { status: 404 })
    }

    await logAudit(
      auditFromApiKey(req, auth),
      'contact.delete',
      { type: 'contact', id: deleted.id },
      { listId: params.listId, email: deleted.email },
    )

    return NextResponse.json({ data: { id: deleted.id }, meta: {}, error: null })
  })
}
